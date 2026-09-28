import assert from "node:assert/strict";
import test from "node:test";
import { Generator } from "../src/generator.js";
import { Model } from "../src/model.js";
import { NameGenerator } from "../src/name_generator.js";

function createRandomSource(): () => number {
	let state = 42;
	return () => {
		state = (state * 48271) % 2147483647;
		return state / 2147483647;
	};
}

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
	assert.throws(
		() => new Model(["ab"], 2, 0, undefined as unknown as string[]),
		/Alphabet must be an array of symbols/,
	);
	assert.throws(
		() => new Model(["ab"], 2, 0, ["#", "a", "bb"]),
		/Alphabet symbols must be single code points/,
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

test("model serialization round-trips through JSON", () => {
	const model = new Model(
		["anna", "anne", "ann", "jonni"],
		2,
		0.1,
		["#", "a", "e", "i", "j", "n", "o"],
		createRandomSource(),
	);
	const revived = Model.deserialize(
		JSON.parse(JSON.stringify(model.serialize())),
		createRandomSource(),
	);

	assert.deepEqual(revived.serialize(), model.serialize());
	assert.deepEqual(JSON.parse(JSON.stringify(model)), model.serialize());

	const letters = (candidate: Model) =>
		["##", "#a", "an", "nn", "jo"].map((context) =>
			candidate.generate(context),
		);
	assert.deepEqual(letters(revived), letters(model));

	revived.retrain(["xy"]);
	assert.deepEqual(
		revived.serialize(),
		new Model(["xy"], 2, 0.1, ["#", "x", "y"]).serialize(),
	);
});

test("generator serialization round-trips through JSON", () => {
	const original = new Generator(
		["anna", "anne", "ann", "jonni"],
		3,
		0.1,
		true,
		createRandomSource(),
	);
	const revived = Generator.deserialize(
		JSON.parse(JSON.stringify(original.serialize())),
		createRandomSource(),
	);

	assert.deepEqual(revived.serialize(), original.serialize());
	assert.deepEqual(JSON.parse(JSON.stringify(original)), original.serialize());

	const words = (candidate: Generator) =>
		Array.from({ length: 8 }, () => candidate.generate(10));
	assert.deepEqual(words(revived), words(original));
});

test("name generator serialization round-trips through JSON", () => {
	const original = new NameGenerator(
		["anna", "anne", "ann", "jonni"],
		2,
		0.1,
		true,
		createRandomSource(),
	);
	const revived = NameGenerator.deserialize(
		JSON.parse(JSON.stringify(original)),
		createRandomSource(),
	);

	assert.deepEqual(revived.serialize(), original.serialize());
	assert.equal(
		revived.generateName(3, 8, "", "", "", ""),
		original.generateName(3, 8, "", "", "", ""),
	);
});

test("deserialized instances have the same fields as constructed instances", () => {
	const model = new Model(["ab"], 2, 0, ["#", "a", "b"]);
	const generator = new Generator(["ab"], 2, 0, true);
	const nameGenerator = new NameGenerator(["ab"], 2, 0, true);

	assert.deepEqual(
		Object.keys(Model.deserialize(model.serialize())).sort(),
		Object.keys(model).sort(),
	);
	assert.deepEqual(
		Object.keys(Generator.deserialize(generator.serialize())).sort(),
		Object.keys(generator).sort(),
	);
	assert.deepEqual(
		Object.keys(NameGenerator.deserialize(nameGenerator.serialize())).sort(),
		Object.keys(nameGenerator).sort(),
	);
});

test("generateName returns null when generation cannot terminate in bounds", () => {
	const generator = new NameGenerator(["a"], 1, 1, false, () => 0.75);

	assert.equal(generator.generateName(1, 3, "", "", "", ""), null);
});

test("applies name constraints", () => {
	const generator = new NameGenerator(["alpha"], 2, 0, false);

	assert.equal(generator.generateName(5, 5, "", "", "", ""), "alpha");
	assert.equal(
		generator.generateName({ minLength: 5, maxLength: 5, startsWith: "al" }),
		"alpha",
	);
	assert.equal(
		generator.generateName({ minLength: 5, maxLength: 5, startsWith: "zz" }),
		null,
	);
	assert.equal(
		generator.generateName({ minLength: 5, maxLength: 5, endsWith: "ha" }),
		"alpha",
	);
	assert.equal(
		generator.generateName({ minLength: 5, maxLength: 5, endsWith: "zz" }),
		null,
	);
	assert.equal(
		generator.generateName({ minLength: 5, maxLength: 5, includes: "lp" }),
		"alpha",
	);
	assert.equal(
		generator.generateName({ minLength: 5, maxLength: 5, includes: "zz" }),
		null,
	);
	assert.equal(
		generator.generateName({ minLength: 5, maxLength: 5, excludes: "zz" }),
		"alpha",
	);
	assert.equal(
		generator.generateName({ minLength: 5, maxLength: 5, excludes: "lp" }),
		null,
	);
	assert.equal(
		generator.generateName({
			minLength: 5,
			maxLength: 5,
			regexMatch: /^a.+a$/,
		}),
		"alpha",
	);
	assert.equal(
		generator.generateName({ minLength: 5, maxLength: 5, regexMatch: /^z/ }),
		null,
	);
	assert.equal(generator.generateName({ minLength: 6, maxLength: 6 }), null);
});

test("positional generateNames fills the batch within the time budget", () => {
	const generator = new NameGenerator(["alpha"], 2, 0, false);

	assert.deepEqual(generator.generateNames(3, 5, 5, "", "", "", ""), [
		"alpha",
		"alpha",
		"alpha",
	]);
	assert.equal(
		generator.generateNames(3, {
			minLength: 5,
			maxLength: 5,
			maxTimePerName: 0,
		}).length,
		0,
	);
});

test("rejects invalid serialized models", () => {
	const valid = new Model(["ab"], 2, 0, ["#", "a", "b"]).serialize();

	assert.throws(() => Model.deserialize(null), /must be a JSON object/);
	assert.throws(
		() => Model.deserialize({ ...valid, format: "markov-namegen/generator" }),
		/format must be/,
	);
	assert.throws(() => Model.deserialize({ ...valid, version: 2 }), /version/);
	assert.throws(
		() => Model.deserialize({ ...valid, order: 3 }),
		/Chain contexts must be exactly/,
	);
	assert.throws(
		() => Model.deserialize({ ...valid, alphabet: ["#", "a", "b", "c"] }),
		/one weight per alphabet symbol/,
	);
	assert.throws(
		() => Model.deserialize({ ...valid, chains: [["##", [2, 1, 3]]] }),
		/non-decreasing/,
	);
	assert.throws(
		() => Model.deserialize({ ...valid, chains: [["##", [0, 0, 0]]] }),
		/positive total/,
	);
	assert.throws(
		() =>
			Model.deserialize({
				...valid,
				chains: [
					["##", [1, 2, 3]],
					["##", [4, 5, 6]],
				],
			}),
		/unique/,
	);
	assert.throws(
		() => Model.deserialize({ ...valid, alphabet: ["#", "a", "a", "b"] }),
		/Alphabet must not contain duplicate symbols/,
	);
	assert.throws(
		() => Model.deserialize({ ...valid, chains: [["##", ["1", 2, 3]]] }),
		/Chain weights must be finite non-negative numbers/,
	);
});

test("rejects invalid serialized generators", () => {
	const valid = new Generator(["ab"], 2, 0, false).serialize();

	assert.throws(() => Generator.deserialize(null), /must be a JSON object/);
	assert.throws(
		() => Generator.deserialize({ ...valid, format: "markov-namegen/model" }),
		/format must be/,
	);
	assert.throws(
		() => Generator.deserialize({ ...valid, models: [] }),
		/non-empty/,
	);
	assert.throws(
		() => Generator.deserialize({ ...valid, backoff: true }),
		/must contain 2 models/,
	);
	assert.throws(
		() =>
			Generator.deserialize({ ...valid, models: [{ order: 1, chains: [] }] }),
		/must have order 2/,
	);
	assert.throws(
		() => Generator.deserialize({ ...valid, models: [null] }),
		/Each model must be a JSON object/,
	);
});
