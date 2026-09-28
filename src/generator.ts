import { assert } from "./assert.js";
import { Model, type RandomSource } from "./model.js";
import type { TrainingData } from "./training.js";
import {
	BOUNDARY,
	buildAlphabet,
	contextFrom,
	validateAlphabet,
	validateTrainingData,
} from "./training.js";

/**
 * The serialized form of a Generator, as produced by Generator.serialize and accepted by Generator.deserialize.
 */
interface SerializedGenerator {
	/**
	 * Discriminator distinguishing generator payloads from other markov-namegen payloads.
	 */
	format: "markov-namegen/generator";
	/**
	 * The version of the serialization format.
	 */
	version: 2;
	/**
	 * The highest order model used by the generator.
	 */
	order: number;
	/**
	 * The dirichlet prior shared by all models.
	 */
	prior: number;
	/**
	 * Whether the generator falls back to lower order models when a higher order model fails to generate a letter.
	 */
	backoff: boolean;
	/**
	 * The alphabet shared by all models, including the "#" boundary marker.
	 */
	alphabet: string[];
	/**
	 * The Markov chains of each model, from highest to lowest order, as [context, [symbol index, count]] pairs with one pair per observed symbol. Symbol indices refer to the alphabet.
	 */
	models: { order: number; chains: [string, [number, number][]][] }[];
}

/**
 * A procedural word generator that uses Markov chains built from a user-provided array of words.
 *
 * This uses a simplified version of Katz's back-off model, which is an approach that uses high-order models. It looks for the next letter based on the last "n" letters, backing down to lower order models when higher models fail.
 *
 * This also uses a Dirichlet prior, which acts as an additive smoothing factor, introducing a chance for random letters to be be picked.
 *
 * @see http://www.samcodes.co.uk/project/markov-namegen/
 * @see https://www.roguebasin.com/index.php?title=Names_from_a_high_order_Markov_Process_and_a_simplified_Katz_back-off_scheme#Katz_Back-off
 * @see https://en.wikipedia.org/wiki/Katz%27s_back-off_model
 * @see https://en.wikipedia.org/wiki/Additive_smoothing
 */

class Generator {
	/**
	 * The highest order model used by this generator.
	 *
	 * Generators own models of order 1 through order "n".
	 * Generators of order "n" look back up to "n" characters when choosing the next character.
	 */
	public readonly order: number;
	/**
	 * Dirichlet prior, acts as an additive smoothing factor.
	 *
	 * The prior adds a constant probability that a random letter is picked from the alphabet when generating a new letter.
	 */
	public readonly prior: number;
	/**
	 * Whether to fall back to lower orders of models when a higher-order model fails to generate a letter.
	 */
	private readonly _backoff: boolean;
	/**
	 * The array of Markov models used by this generator, starting from highest order to lowest order.
	 */
	private readonly _models: Model[];

	/**
	 * Creates a new procedural word Generator.
	 * @param   data    Training data for the generator, an array of words.
	 * @param   order   Highest order of model to use - models of order 1 through order will be generated.
	 * @param   prior   The dirichlet prior/additive smoothing "randomness" factor.
	 * @param   backoff Whether to fall back to lower order models when the highest order model fails to generate a letter.
	 */
	constructor(
		data: TrainingData,
		order: number,
		prior: number,
		backoff: boolean,
		random: RandomSource = Math.random,
	) {
		validateTrainingData(data);
		assert(
			Number.isInteger(order) && order >= 1,
			"Order must be a positive integer",
		);
		assert(
			Number.isFinite(prior) && prior >= 0 && prior <= 1,
			"Prior must be a finite number between 0 and 1",
		);

		this.order = order;
		this.prior = prior;
		this._backoff = backoff;

		const domain = buildAlphabet(data);

		this._models = [];
		if (this._backoff) {
			for (let i = 0; i < order; i++) {
				this._models.push(
					new Model([...data], order - i, prior, domain, random),
				); // from highest to lowest order
			}
		} else {
			this._models.push(new Model(data, order, prior, domain, random));
		}
	}

	/**
	 * Generates a word, including the leading boundary markers (one "#" per order).
	 * @param   maxLength When supplied, returns null if generation cannot terminate within this length. Without a maximum length, generation can loop indefinitely when no reachable context predicts the boundary marker, which is possible with a prior of 0 and cyclic training data.
	 * @param   random  Optional random source used for this call, overriding the sources bound at construction.
	 * @return The generated word, or null if it could not be generated within the given length.
	 */
	generate(): string;
	generate(maxLength: number, random?: RandomSource): string | null;
	generate(maxLength?: number, random?: RandomSource): string | null {
		if (maxLength !== undefined) {
			assert(
				Number.isInteger(maxLength) && maxLength >= 0,
				"Maximum length must be a non-negative integer",
			);
		}

		let word = BOUNDARY.repeat(this.order);
		let generatedLength = 0;
		let letter = this.getLetter(word, random);

		while (letter !== "#" && letter != null) {
			if (maxLength !== undefined && generatedLength >= maxLength) {
				return null;
			}
			word += letter;
			generatedLength++;
			letter = this.getLetter(word, random);
		}

		if (maxLength !== undefined && letter === null) {
			return null;
		}

		return word;
	}

	/**
	 * Generates the next letter in a word.
	 * @param   word The context the models will use for generating the next letter.
	 * @param   random  Optional random source used for this call, overriding the sources bound at construction.
	 * @return  The generated letter, or null if no model could generate one.
	 */
	private getLetter(word: string, random?: RandomSource): string | null {
		assert(word.length > 0);

		let letter: string | null = null;
		let context = contextFrom(word, this.order);
		for (const model of this._models) {
			letter = model.generate(context, random);
			if (letter == null) {
				context = Array.from(context).slice(1).join("");
			} else {
				break;
			}
		}

		return letter;
	}

	/**
	 * Serializes the generator into a plain JSON-serializable object. The alphabet is shared by all models and serialized once.
	 * The random source cannot be serialized, so it must be supplied when deserializing.
	 * @return  The serialized generator.
	 */
	serialize(): SerializedGenerator {
		const serializedModels = this._models.map((model) => model.serialize());
		const first = serializedModels[0];
		assert(first !== undefined);
		return {
			format: "markov-namegen/generator",
			version: 2,
			order: this.order,
			prior: this.prior,
			backoff: this._backoff,
			alphabet: first.alphabet,
			models: serializedModels.map(({ order, chains }) => ({
				order,
				chains,
			})),
		};
	}

	/**
	 * Returns the serialized form of this generator, used by JSON.stringify.
	 * @return  The serialized generator.
	 */
	toJSON(): SerializedGenerator {
		return this.serialize();
	}

	/**
	 * Rebuilds a generator from its serialized form.
	 * The payload is validated at runtime, and malformed input throws an error.
	 * @param   json    The serialized generator, as produced by serialize().
	 * @param   random  The random source used when generating, defaults to Math.random.
	 * @return  The deserialized generator.
	 */
	static deserialize(
		json: unknown,
		random: RandomSource = Math.random,
	): Generator {
		const state = parseSerializedGenerator(json);
		const models = state.models.map((model) => {
			const payload = {
				format: "markov-namegen/model",
				version: state.version,
				order: model.order,
				prior: state.prior,
				alphabet: state.alphabet,
				chains: model.chains,
			};
			return Model.deserialize(payload, random);
		});
		const generator = Object.create(Generator.prototype) as Generator;
		Object.assign(generator, {
			order: state.order,
			prior: state.prior,
			_backoff: state.backoff,
			_models: models,
		});
		return generator;
	}
}

function parseSerializedGenerator(json: unknown): {
	version: 1 | 2;
	order: number;
	prior: number;
	backoff: boolean;
	alphabet: string[];
	models: { order: number; chains: unknown }[];
} {
	assert(
		typeof json === "object" && json !== null && !Array.isArray(json),
		"Serialized generator must be a JSON object",
	);
	const record = json as Record<string, unknown>;
	assert(
		record.format === "markov-namegen/generator",
		'Serialized generator format must be "markov-namegen/generator"',
	);
	const version = record.version;
	assert(
		version === 1 || version === 2,
		"Serialized generator version must be 1 or 2",
	);

	const order = record.order;
	assert(
		typeof order === "number" && Number.isInteger(order) && order >= 1,
		"Order must be a positive integer",
	);

	const prior = record.prior;
	assert(
		typeof prior === "number" &&
			Number.isFinite(prior) &&
			prior >= 0 &&
			prior <= 1,
		"Prior must be a finite number between 0 and 1",
	);

	const backoff = record.backoff;
	assert(typeof backoff === "boolean", "Backoff must be a boolean");

	const alphabet = validateAlphabet(record.alphabet);

	const models = record.models;
	assert(
		Array.isArray(models) && models.length > 0,
		"Models must be a non-empty array of serialized models",
	);
	const expectedOrders = backoff
		? Array.from({ length: order }, (_, i) => order - i)
		: [order];
	assert(
		models.length === expectedOrders.length,
		`Serialized generator must contain ${expectedOrders.length} models`,
	);
	const parsedModels = models.map((model, index) => {
		assert(
			typeof model === "object" && model !== null && !Array.isArray(model),
			"Each model must be a JSON object",
		);
		const modelRecord = model as Record<string, unknown>;
		const expectedOrder = expectedOrders[index];
		assert(
			expectedOrder !== undefined && modelRecord.order === expectedOrder,
			`Model at index ${index} must have order ${expectedOrder}`,
		);
		return {
			order: modelRecord.order as number,
			chains: modelRecord.chains,
		};
	});

	return {
		version,
		order,
		prior,
		backoff,
		alphabet,
		models: parsedModels,
	};
}

export type { SerializedGenerator };
export { Generator };
