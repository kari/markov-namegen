import { assert } from "./assert.js";
import type { TrainingData } from "./training.js";
import {
	buildAlphabet,
	validateAlphabet,
	validateTrainingData,
} from "./training.js";

type RandomSource = () => number;

/**
 * The serialized form of a Model, as produced by Model.serialize and accepted by Model.deserialize.
 */
interface SerializedModel {
	/**
	 * Discriminator distinguishing model payloads from other markov-namegen payloads.
	 */
	format: "markov-namegen/model";
	/**
	 * The version of the serialization format.
	 */
	version: 2;
	/**
	 * The order of the model i.e. how many characters the model looks back.
	 */
	order: number;
	/**
	 * The dirichlet prior used by the model.
	 */
	prior: number;
	/**
	 * The alphabet of the model, including the "#" boundary marker.
	 */
	alphabet: string[];
	/**
	 * The Markov chains as [context, [symbol index, count]] pairs, with one pair per observed symbol. Symbol indices refer to the alphabet, and unobserved symbols get the dirichlet prior as their weight when the model is rebuilt.
	 */
	chains: [string, [number, number][]][];
}

/**
 * A Markov model built using string training data.
 */
class Model {
	/**
	 * The order of the model i.e. how many characters this model looks back.
	 */
	private readonly _order: number;
	/**
	 * Dirichlet prior, like additive smoothing, increases the probability of any item being picked.
	 */
	private readonly _prior: number;
	/**
	 * The alphabet of the training data.
	 */
	private _alphabet: string[];
	/**
	 * The observations.
	 */
	private _observations: Map<string, Map<string, number>>;
	/**
	 * The Markov chains.
	 */
	private _chains!: Map<string, number[]>;

	/**
	 * Creates a new Markov model.
	 * @param   data    The training data for the model, an array of words.
	 * @param   order   The order of model to use, models of order "n" will look back "n" characters within their context when determining the next letter.
	 * @param   prior   The dirichlet prior, an additive smoothing "randomness" factor. Must be in the range 0 to 1.
	 * @param   alphabet    The alphabet of the training data i.e. the set of unique symbols used in the training data.
	 */
	constructor(
		data: TrainingData,
		order: number,
		prior: number,
		alphabet: string[],
		private readonly random: RandomSource = Math.random,
	) {
		validateTrainingData(data);
		const validatedAlphabet = validateAlphabet(alphabet);
		assert(
			data.every((word) =>
				Array.from(word).every((symbol) => validatedAlphabet.includes(symbol)),
			),
			"Alphabet must include every symbol in the training data",
		);
		assert(
			Number.isInteger(order) && order >= 1,
			"Order must be a positive integer",
		);
		assert(
			Number.isFinite(prior) && prior >= 0 && prior <= 1,
			"Prior must be a finite number between 0 and 1",
		);

		this._order = order;
		this._prior = prior;
		this._alphabet = validatedAlphabet;

		this._observations = new Map<string, Map<string, number>>();
		this.train(data);
		this.buildChains();
	}

	/**
	 * Attempts to generate the next letter in the word given the context (the previous "order" letters).
	 * @param   context The previous "order" letters in the word.
	 * @param   random  Optional random source used for this call, overriding the source bound at construction.
	 * @return  The generated letter, or null if the context is unknown to the model.
	 */
	generate(context: string, random?: RandomSource): string | null {
		const chain = this._chains.get(context);
		if (chain === undefined) {
			return null;
		}
		assert(chain.length > 0);
		const prediction = this._alphabet[this.selectIndex(chain, random)];
		assert(prediction !== undefined);
		return prediction;
	}

	/**
	 * Retrains the model on the newly supplied data, regenerating the Markov chains.
	 * @param   data    The new training data.
	 */
	retrain(data: TrainingData) {
		validateTrainingData(data);
		this._alphabet = buildAlphabet(data);
		this._observations = new Map<string, Map<string, number>>();
		this.train(data);
		this.buildChains();
	}

	/**
	 * Serializes the model into a plain JSON-serializable object. The chains are stored as sparse symbol counts (format version 2), which is roughly an order of magnitude smaller than the dense cumulative weights of version 1. The observations are not serialized as the Markov chains fully determine generation.
	 * The random source cannot be serialized, so it must be supplied when deserializing.
	 * @return  The serialized model.
	 */
	serialize(): SerializedModel {
		return {
			format: "markov-namegen/model",
			version: 2,
			order: this._order,
			prior: this._prior,
			alphabet: [...this._alphabet],
			chains: [...this._chains].map(([context, chain]) => {
				const pairs: [number, number][] = [];
				let previous = 0;
				chain.forEach((cumulative, index) => {
					const count = Math.round(cumulative - previous - this._prior);
					if (count > 0) {
						pairs.push([index, count]);
					}
					previous = cumulative;
				});
				return [context, pairs];
			}),
		};
	}

	/**
	 * Returns the serialized form of this model, used by JSON.stringify.
	 * @return  The serialized model.
	 */
	toJSON(): SerializedModel {
		return this.serialize();
	}

	/**
	 * Rebuilds a model from its serialized form.
	 * The payload is validated at runtime, and malformed input throws an error. The deserialized model does not retain the training observations, which are not needed for generation; retrain() rebuilds them when retraining on new data.
	 * @param   json    The serialized model, as produced by serialize().
	 * @param   random  The random source used when generating, defaults to Math.random.
	 * @return  The deserialized model.
	 */
	static deserialize(json: unknown, random: RandomSource = Math.random): Model {
		const state = parseSerializedModel(json);
		const model = Object.create(Model.prototype) as Model;
		Object.assign(model, {
			_order: state.order,
			_prior: state.prior,
			_alphabet: state.alphabet,
			_observations: new Map<string, Map<string, number>>(),
			_chains: state.chains,
			random,
		});
		return model;
	}

	/**
	 * Trains the model on the given training data.
	 * @param   data    The training data.
	 */
	private train(data: TrainingData) {
		for (const word of data) {
			const symbols = [
				...Array.from({ length: this._order }, () => "#"),
				...Array.from(word),
				"#",
			];
			for (let i = 0; i <= symbols.length - this._order - 1; i++) {
				const key = symbols.slice(i, i + this._order).join("");
				let value = this._observations.get(key);
				if (value == null) {
					value = new Map<string, number>();
					this._observations.set(key, value);
				}
				const prediction = symbols[i + this._order];
				assert(prediction !== undefined);
				value.set(prediction, (value.get(prediction) ?? 0) + 1);
			}
		}
	}

	/**
	 * Builds the Markov chains for the model.
	 */
	private buildChains() {
		this._chains = new Map<string, number[]>();

		for (const [context, counts] of this._observations) {
			const chain: number[] = [];
			let total = 0;
			this._chains.set(context, chain);
			for (const prediction of this._alphabet) {
				total += this._prior + (counts.get(prediction) ?? 0);
				chain.push(total);
			}
		}
	}

	private selectIndex(chain: number[], random?: RandomSource): number {
		const total = chain[chain.length - 1];
		assert(total !== undefined && total > 0);

		const randomValue = (random ?? this.random)();
		assert(
			Number.isFinite(randomValue) && randomValue >= 0 && randomValue < 1,
			"Random source must return a finite number from 0 (inclusive) to 1 (exclusive)",
		);
		const rand = randomValue * total;
		for (let i = 0; i < chain.length; i++) {
			const cumulative = chain[i];
			if (cumulative !== undefined && rand < cumulative) {
				return i;
			}
		}

		return 0;
	}
}

function parseSerializedModel(json: unknown): {
	order: number;
	prior: number;
	alphabet: string[];
	chains: Map<string, number[]>;
} {
	assert(
		typeof json === "object" && json !== null && !Array.isArray(json),
		"Serialized model must be a JSON object",
	);
	const record = json as Record<string, unknown>;
	assert(
		record.format === "markov-namegen/model",
		'Serialized model format must be "markov-namegen/model"',
	);
	const version = record.version;
	assert(
		version === 1 || version === 2,
		"Serialized model version must be 1 or 2",
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

	const alphabet = validateAlphabet(record.alphabet);

	const chains = record.chains;
	assert(
		Array.isArray(chains),
		"Chains must be an array of [context, weights] pairs",
	);
	const chainMap = new Map<string, number[]>();
	for (const entry of chains) {
		assert(
			Array.isArray(entry) && entry.length === 2,
			"Chains must be an array of [context, weights] pairs",
		);
		const [context, weights] = entry;
		assert(typeof context === "string", "Chain contexts must be strings");
		assert(
			Array.from(context).length === order,
			"Chain contexts must be exactly 'order' symbols long",
		);
		assert(
			Array.from(context).every((symbol) => alphabet.includes(symbol)),
			"Chain contexts must only contain alphabet symbols",
		);
		assert(!chainMap.has(context), "Chain contexts must be unique");
		if (version === 1) {
			chainMap.set(context, parseDenseChain(weights, alphabet));
		} else {
			chainMap.set(context, parseSparseChain(weights, alphabet, prior));
		}
	}

	return {
		order,
		prior,
		alphabet,
		chains: chainMap,
	};
}

function parseDenseChain(weights: unknown, alphabet: string[]): number[] {
	assert(
		Array.isArray(weights) && weights.length === alphabet.length,
		"Each chain must have exactly one weight per alphabet symbol",
	);
	const chain: number[] = [];
	let total = 0;
	for (const weight of weights) {
		assert(
			typeof weight === "number" && Number.isFinite(weight) && weight >= 0,
			"Chain weights must be finite non-negative numbers",
		);
		assert(
			weight >= total,
			"Chain weights must be non-decreasing cumulative totals",
		);
		total = weight;
		chain.push(weight);
	}
	assert(total > 0, "Each chain must have a positive total weight");
	return chain;
}

function parseSparseChain(
	pairs: unknown,
	alphabet: string[],
	prior: number,
): number[] {
	assert(
		Array.isArray(pairs),
		"Each chain must be an array of [symbol index, count] pairs",
	);
	const counts = new Array<number>(alphabet.length).fill(0);
	const seen = new Set<number>();
	for (const pair of pairs) {
		assert(
			Array.isArray(pair) && pair.length === 2,
			"Each chain must be an array of [symbol index, count] pairs",
		);
		const [index, count] = pair;
		assert(
			typeof index === "number" &&
				Number.isInteger(index) &&
				index >= 0 &&
				index < alphabet.length,
			"Chain symbol indices must be integers within the alphabet",
		);
		assert(!seen.has(index), "Chain symbol indices must be unique");
		seen.add(index);
		assert(
			typeof count === "number" && Number.isInteger(count) && count > 0,
			"Chain counts must be positive integers",
		);
		counts[index] = count;
	}
	const chain: number[] = [];
	let total = 0;
	for (const count of counts) {
		total += prior + count;
		chain.push(total);
	}
	assert(total > 0, "Each chain must have a positive total weight");
	return chain;
}

export type { RandomSource, SerializedModel };
export { Model };
