import { assert } from "./assert";

type RandomSource = () => number;

/**
 * A Markov model built using string training data.
 */
class Model {
	/**
	 * The order of the model i.e. how many characters this model looks back.
	 */
	private _order: number;
	/**
	 * Dirichlet prior, like additive smoothing, increases the probability of any item being picked.
	 */
	private _prior: number;
	/**
	 * The alphabet of the training data.
	 */
	private _alphabet: string[];
	/**
	 * The observations.
	 */
	private _observations: Map<string, string[]>;
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
		data: readonly string[],
		order: number,
		prior: number,
		alphabet: string[],
		private readonly random: RandomSource = Math.random,
	) {
		assert(data.length > 0, "Training data must not be empty");
		assert(alphabet.length > 0, "Alphabet must not be empty");
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
		this._alphabet = alphabet;

		this._observations = new Map<string, string[]>();
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
		return this._alphabet[this.selectIndex(chain)];
	}

	/**
	 * Retrains the model on the newly supplied data, regenerating the Markov chains.
	 * @param   data    The new training data.
	 */
	retrain(data: readonly string[]) {
		assert(data.length > 0, "Training data must not be empty");
		this._observations = new Map<string, string[]>();
		this.train(data);
		this.buildChains();
	}

	/**
	 * Trains the model on the given training data.
	 * @param   data    The training data.
	 */
	private train(data: readonly string[]) {
		for (const word of data) {
			const d = `${"#".repeat(this._order)}${word}#`;
			for (let i = 0; i <= d.length - this._order; i++) {
				const key = d.substring(i, i + this._order);
				let value = this._observations.get(key);
				if (value == null) {
					value = [];
					this._observations.set(key, value);
				}
				value.push(d.charAt(i + this._order));
			}
		}
	}

	/**
	 * Builds the Markov chains for the model.
	 */
	private buildChains() {
		this._chains = new Map<string, number[]>();

		for (const context of this._observations.keys()) {
			for (const prediction of this._alphabet) {
				let value = this._chains.get(context);
				if (value == null) {
					value = [];
					this._chains.set(context, value);
				}
				value.push(
					this._prior +
						this.countMatches(this._observations.get(context), prediction),
				);
			}
		}
	}

	private countMatches(arr: string[] | undefined, v: string): number {
		if (arr === undefined) {
			return 0;
		}

		let i = 0;
		for (const s of arr) {
			if (s === v) {
				i++;
			}
		}

		return i;
	}

	private selectIndex(chain: number[]): number {
		const totals: number[] = [];
		let accumulator = 0;

		for (const weight of chain) {
			accumulator += weight;
			totals.push(accumulator);
		}

		const randomValue = this.random();
		assert(
			Number.isFinite(randomValue) && randomValue >= 0 && randomValue < 1,
			"Random source must return a finite number from 0 (inclusive) to 1 (exclusive)",
		);
		const rand = randomValue * accumulator;
		for (let i = 0; i < totals.length; i++) {
			if (rand < totals[i]) {
				return i;
			}
		}

		return 0;
	}
}

export type { RandomSource };
export { Model };
