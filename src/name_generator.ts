import { assert } from "./assert.js";
import { Generator } from "./generator.js";
import type { RandomSource } from "./model.js";

interface NameGenerationOptions {
	minLength: number;
	maxLength: number;
	startsWith?: string;
	endsWith?: string;
	includes?: string;
	excludes?: string;
	regexMatch?: RegExp | null;
}

interface NameBatchOptions extends NameGenerationOptions {
	/**
	 * The average time in milliseconds to spend generating each name. The total time budget for generating n names is maxTimePerName * n. Defaults to 200.
	 */
	maxTimePerName?: number;
}

interface ResolvedNameGenerationOptions {
	minLength: number;
	maxLength: number;
	startsWith: string;
	endsWith: string;
	includes: string;
	excludes: string;
	regexMatch: RegExp | null;
}

function resolveOptions(
	optionsOrMinLength: NameGenerationOptions | number,
	maxLength?: number,
	startsWith = "",
	endsWith = "",
	includes = "",
	excludes = "",
	regexMatch: RegExp | null = null,
): ResolvedNameGenerationOptions {
	if (typeof optionsOrMinLength === "number") {
		return {
			minLength: optionsOrMinLength,
			maxLength: maxLength as number,
			startsWith,
			endsWith,
			includes,
			excludes,
			regexMatch,
		};
	}

	return {
		minLength: optionsOrMinLength.minLength,
		maxLength: optionsOrMinLength.maxLength,
		startsWith: optionsOrMinLength.startsWith ?? "",
		endsWith: optionsOrMinLength.endsWith ?? "",
		includes: optionsOrMinLength.includes ?? "",
		excludes: optionsOrMinLength.excludes ?? "",
		regexMatch: optionsOrMinLength.regexMatch ?? null,
	};
}

/**
 * An example name generator that builds upon the Generator class. This should be sufficient for most simple name generation scenarios.
 *
 * For complex name generators, modifying the Generator class to your specifications may be more appropriate or performant than extending this approach.
 */
class NameGenerator {
	/**
	 * The underlying word generator.
	 */
	private _generator: Generator;

	/**
	 * Creates a new procedural name generator.
	 * @param   data    Training data for the generator, an array of words.
	 * @param   order   Highest order of model to use - models 1 to order will be generated.
	 * @param   prior   The dirichlet prior/additive smoothing "randomness" factor.
	 * @param   backoff Whether to fall back to lower order models when the highest order model fails to generate a letter (defaults to false).
	 */
	constructor(
		data: readonly string[],
		order: number,
		prior: number,
		backoff = false,
		random: RandomSource = Math.random,
	) {
		this._generator = new Generator(data, order, prior, backoff, random);
	}

	/**
	 * Creates a word within the given constraints.
	 * If the generated word does not meet the constraints, this returns null.
	 * @param   minLength   The minimum length of the word.
	 * @param   maxLength   The maximum length of the word.
	 * @param   startsWith  The text the word must start with.
	 * @param   endsWith    The text the word must end with.
	 * @param   includes    The text the word must include.
	 * @param   excludes    The text the word must exclude.
	 * @param   regexMatch  The regular expression the word must match.
	 * @return  A word that meets the specified constraints, or null if the generated word did not meet the constraints.
	 */
	generateName(options: NameGenerationOptions): string | null;
	generateName(
		minLength: number,
		maxLength: number,
		startsWith: string,
		endsWith: string,
		includes: string,
		excludes: string,
		regexMatch?: RegExp | null,
	): string | null;
	generateName(
		optionsOrMinLength: NameGenerationOptions | number,
		maxLength?: number,
		startsWith = "",
		endsWith = "",
		includes = "",
		excludes = "",
		regexMatch: RegExp | null = null,
	): string | null {
		const options = resolveOptions(
			optionsOrMinLength,
			maxLength,
			startsWith,
			endsWith,
			includes,
			excludes,
			regexMatch,
		);
		return this.generateNameWithOptions(options);
	}

	private generateNameWithOptions(
		options: ResolvedNameGenerationOptions,
	): string | null {
		assert(
			Number.isInteger(options.minLength) && options.minLength >= 0,
			"Minimum length must be a non-negative integer",
		);
		assert(
			Number.isInteger(options.maxLength) &&
				options.maxLength >= options.minLength,
			"Maximum length must be an integer greater than or equal to minimum length",
		);

		let name: string;

		const generated = this._generator.generate(options.maxLength);
		if (generated === null) {
			return null;
		}
		name = generated;
		name = name.replaceAll("#", "");

		if (
			Array.from(name).length >= options.minLength &&
			Array.from(name).length <= options.maxLength &&
			name.startsWith(options.startsWith) &&
			name.endsWith(options.endsWith) &&
			(options.includes.length === 0 || name.includes(options.includes)) &&
			(options.excludes.length === 0 || !name.includes(options.excludes)) &&
			(options.regexMatch == null || name.match(options.regexMatch))
		) {
			return name;
		}

		return null;
	}

	/**
	 * Attempts to generate "n" names that meet the given constraints within an allotted time.
	 * @param   n   The number of names to generate.
	 * @param   minLength   The minimum length of the word.
	 * @param   maxLength   The maximum length of the word.
	 * @param   startsWith  The text the word must start with.
	 * @param   endsWith    The text the word must end with.
	 * @param   includes    The text the word must include.
	 * @param   excludes    The text the word must exclude.
	 * @param   maxTimePerName  The average time in milliseconds to spend generating each name. The total time budget for generating n names is maxTimePerName * n.
	 * @param   regexMatch  The regular expression the word must match.
	 * @return  The generated names, or fewer names if the time budget ran out.
	 */
	generateNames(n: number, options: NameBatchOptions): string[];
	generateNames(
		n: number,
		minLength: number,
		maxLength: number,
		startsWith: string,
		endsWith: string,
		includes: string,
		excludes: string,
		maxTimePerName?: number,
		regexMatch?: RegExp | null,
	): string[];
	generateNames(
		n: number,
		optionsOrMinLength: NameBatchOptions | number,
		maxLength?: number,
		startsWith = "",
		endsWith = "",
		includes = "",
		excludes = "",
		maxTimePerName = 200,
		regexMatch: RegExp | null = null,
	): string[] {
		const options = resolveOptions(
			optionsOrMinLength,
			maxLength,
			startsWith,
			endsWith,
			includes,
			excludes,
			regexMatch,
		);
		const timePerName =
			typeof optionsOrMinLength === "number"
				? maxTimePerName
				: (optionsOrMinLength.maxTimePerName ?? 200);
		return this.generateNamesWithOptions(n, options, timePerName);
	}

	private generateNamesWithOptions(
		n: number,
		options: ResolvedNameGenerationOptions,
		maxTimePerName: number,
	): string[] {
		assert(
			Number.isInteger(n) && n >= 0,
			"Name count must be a non-negative integer",
		);
		assert(
			Number.isInteger(options.minLength) && options.minLength >= 0,
			"Minimum length must be a non-negative integer",
		);
		assert(
			Number.isInteger(options.maxLength) &&
				options.maxLength >= options.minLength,
			"Maximum length must be an integer greater than or equal to minimum length",
		);
		assert(
			Number.isFinite(maxTimePerName) && maxTimePerName >= 0,
			"Maximum time per name must be a non-negative finite number",
		);

		const names: string[] = [];

		const startTime = Date.now();
		let currentTime = Date.now();

		while (names.length < n && currentTime < startTime + maxTimePerName * n) {
			const name = this.generateName(options);
			if (name != null) {
				names.push(name);
			}

			currentTime = Date.now();
		}

		return names;
	}
}

export type { NameBatchOptions, NameGenerationOptions };
export { NameGenerator };
