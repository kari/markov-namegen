import assert from "node:assert/strict";
import test from "node:test";
import { Generator } from "../src/generator";
import { Model } from "../src/model";
import { NameGenerator } from "../src/name_generator";

test("training does not mutate the input data", () => {
	const data = ["alpha", "beta"];
	new Generator(data, 2, 0, false);

	assert.deepEqual(data, ["alpha", "beta"]);
});

test("rejects invalid model configuration", () => {
	assert.throws(
		() => new Generator([], 2, 0, false),
		/Training data must not be empty/,
	);
	assert.throws(
		() => new Generator(["alpha"], 0, 0, false),
		/Order must be a positive integer/,
	);
	assert.throws(
		() => new Generator(["alpha"], 2, Number.NaN, false),
		/Prior must be a finite number/,
	);
	assert.throws(
		() => new Generator(["alpha"], 2, 2, false),
		/Prior must be a finite number/,
	);
});

test("rejects invalid generation constraints", () => {
	const generator = new NameGenerator(["alpha"], 2, 0);

	assert.throws(
		() => generator.generateName(-1, 10, "", "", "", ""),
		/Minimum length/,
	);
	assert.throws(
		() => generator.generateName(10, 5, "", "", "", ""),
		/Maximum length/,
	);
	assert.throws(
		() => generator.generateNames(0, -1, 10, "", "", "", ""),
		/Minimum length/,
	);
	assert.throws(
		() => generator.generateNames(1.5, 1, 10, "", "", "", ""),
		/Name count/,
	);
	assert.throws(
		() => generator.generateNames(1, 1, 10, "", "", "", "", -1),
		/Maximum time/,
	);
});

test("retraining replaces the previous observations", () => {
	const model = new Model(["ab"], 2, 0, ["#", "a", "b", "c", "d"]);

	assert.equal(model.generate("##"), "a");

	model.retrain(["cd"]);

	assert.equal(model.generate("##"), "c");
	assert.throws(() => model.retrain([]), /Training data must not be empty/);
});

test("name generator produces names without the boundary marker", () => {
	const generator = new NameGenerator(["anna", "anne", "ann"], 2, 0, true);
	const name = generator.generateName(1, 10, "", "", "", "");

	assert.ok(name !== null && name.length > 0);
	assert.equal(name?.includes("#"), false);
});
