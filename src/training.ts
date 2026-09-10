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

function contextFrom(word: string, order: number): string {
	return Array.from(word).slice(-order).join("");
}

export type { TrainingData };
export { BOUNDARY, buildAlphabet, contextFrom, validateTrainingData };
