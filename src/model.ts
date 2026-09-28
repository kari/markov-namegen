import { assert } from "./assert.js";
import type { TrainingData } from "./training.js";
import { buildAlphabet, validateTrainingData } from "./training.js";

type RandomSource = () => number;

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
		assert(alphabet.length > 0, "Alphabet must not be empty");
		assert(
			alphabet.includes("#"),
			"Alphabet must include '#' as the boundary marker",
		);
		assert(
			alphabet.length === new Set(alphabet).size,
			"Alphabet must not contain duplicate symbols",
		);
		assert(
			data.every((word) =>
				Array.from(word).every((symbol) => alphabet.includes(symbol)),
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
		this._alphabet = [...alphabet];

		this._observations = new Map<string, Map<string, number>>();
		this.train(data);
		this.buildChains();
	}

	/**
	 * Attempts to generate the next letter in the word given the context (the previous "order" letters).
	 * @param   context The previous "order" letters in the word.
	 */
	generate(context: string): string | null {
		const chain = this._chains.get(context);
		if (chain === undefined) {
			return null;
		}
		assert(chain.length > 0);
		const prediction = this._alphabet[this.selectIndex(chain)];
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

	private selectIndex(chain: number[]): number {
		const total = chain[chain.length - 1];
		assert(total !== undefined && total > 0);

		const randomValue = this.random();
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

export type { RandomSource };
export { Model };
