import { assert } from "./assert.js";

const BOUNDARY = "#";

type TrainingData = readonly string[];

function validateTrainingData(data: TrainingData): void {
	assert(data.length > 0, "Training data must not be empty");
	assert(
		data.every(
			(word) =>
				typeof word === "string" && word.length > 0 && !word.includes(BOUNDARY),
		),
		"Training words must be non-empty and must not contain '#'",
	);
}

function buildAlphabet(data: TrainingData): string[] {
	const alphabet = new Set<string>();
	for (const word of data) {
		for (const symbol of Array.from(word)) {
			alphabet.add(symbol);
		}
	}

	return [BOUNDARY, ...[...alphabet].sort()];
}

/**
 * Validates an alphabet: a non-empty array of unique single-code-point symbols that includes the "#" boundary marker.
 * @param   alphabet    The alphabet to validate.
 * @return  The validated alphabet as a new array of symbols.
 */
function validateAlphabet(alphabet: unknown): string[] {
	assert(Array.isArray(alphabet), "Alphabet must be an array of symbols");
	assert(alphabet.length > 0, "Alphabet must not be empty");
	const symbols: string[] = [];
	for (const symbol of alphabet) {
		assert(
			typeof symbol === "string" && Array.from(symbol).length === 1,
			"Alphabet symbols must be single code points",
		);
		symbols.push(symbol);
	}
	assert(
		symbols.includes("#"),
		"Alphabet must include '#' as the boundary marker",
	);
	assert(
		symbols.length === new Set(symbols).size,
		"Alphabet must not contain duplicate symbols",
	);
	return symbols;
}

function contextFrom(word: string, order: number): string {
	return Array.from(word).slice(-order).join("");
}

export type { TrainingData };
export {
	BOUNDARY,
	buildAlphabet,
	contextFrom,
	validateAlphabet,
	validateTrainingData,
};
