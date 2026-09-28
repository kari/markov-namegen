import assert from "node:assert/strict";
import test from "node:test";
import { Generator } from "../src/generator.js";
import { Model } from "../src/model.js";
import { NameGenerator } from "../src/name_generator.js";

test("training does not mutate the input data", () => {
	const data = ["alpha", "beta"];
	new Generator(data, 2, 0, false);

	assert.deepEqual(data, ["alpha", "beta"]);
});

test("uses the supplied random source", () => {
	let calls = 0;
	const random = () => {
		calls++;
		return 0.999;
	};
	const model = new Model(["ab"], 2, 0, ["#", "a", "b"], random);

	assert.equal(model.generate("##"), "a");
	assert.equal(calls, 1);
});

test("forwards the random source through NameGenerator", () => {
	const generator = new NameGenerator(["ab"], 2, 0, false, () => 0.999);

	assert.equal(generator.generateName(2, 2, "", "", "", ""), "ab");
});

test("supports named generation options", () => {
	const generator = new NameGenerator(["ab"], 2, 0, false, () => 0.999);

	assert.equal(
		generator.generateName({ minLength: 2, maxLength: 2, startsWith: "a" }),
		"ab",
	);
	assert.deepEqual(
		generator.generateNames(1, {
			minLength: 2,
			maxLength: 2,
			maxTimePerName: 200,
		}),
		["ab"],
	);
});

test("counts Unicode code points as name characters", () => {
	const generator = new NameGenerator(["😀a"], 1, 0, false, () => 0.999);

	assert.equal(generator.generateName(2, 2, "", "", "", ""), "😀a");
});

test("bounds generation when a model does not produce a terminator", () => {
	const generator = new Generator(["a"], 1, 1, false, () => 0.75);

	assert.equal(generator.generate(3), null);
});

test("rejects invalid random source values", () => {
	const model = new Model(["ab"], 2, 0, ["#", "a", "b"], () => 1);

	assert.throws(
		() => model.generate("##"),
		/Random source must return a finite number/,
	);
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
	assert.throws(
		() => new Generator([""], 2, 0, false),
		/Training words must be non-empty/,
	);
	assert.throws(
		() => new Generator(["al#pha"], 2, 0, false),
		/Training words must be non-empty/,
	);
	assert.throws(
		() => new Model(["ab"], 2, 0, ["#", "a"]),
		/Alphabet must include every symbol/,
	);
	assert.throws(
		() => new Model(["ab"], 2, 0, ["#", "a", "b", "b"]),
		/Alphabet must not contain duplicate symbols/,
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

test("retraining rebuilds the alphabet", () => {
	const model = new Model(["ab"], 1, 0, ["#", "a", "b"], () => 0);

	model.retrain(["z"]);

	assert.equal(model.generate("#"), "z");
});

test("name generator produces names without the boundary marker", () => {
	const generator = new NameGenerator(["anna", "anne", "ann"], 2, 0, true);
	const name = generator.generateName(1, 10, "", "", "", "");

	assert.ok(name !== null && name.length > 0);
	assert.equal(name?.includes("#"), false);
});
