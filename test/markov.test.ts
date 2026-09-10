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

test("retraining replaces the previous observations", () => {
	const model = new Model(["ab"], 2, 0, ["#", "a", "b", "c", "d"]);

	assert.equal(model.generate("##"), "a");

	model.retrain(["cd"]);

	assert.equal(model.generate("##"), "c");
});

test("name generator produces names without the boundary marker", () => {
	const generator = new NameGenerator(["anna", "anne", "ann"], 2, 0, true);
	const name = generator.generateName(1, 10, "", "", "", "");

	assert.ok(name !== null && name.length > 0);
	assert.equal(name?.includes("#"), false);
});
