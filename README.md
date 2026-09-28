# markov-namegen

This is a TypeScript port of [markov-namegen-lib](https://github.com/Tw1ddle/markov-namegen-lib). It is a Markov chain based name or word generator library.

The package is ESM-only and requires an environment with native ES modules.
CommonJS consumers should migrate from `require()` to a native `import` or use dynamic `import()`.
On Node 22.12 and later, plain `require()` of this package also works.

## Features

Offers most of the features available in the reference Haxe implementation

- A simplified [Katz back-off](https://en.wikipedia.org/wiki/Katz%27s_back-off_model) using high order models - look up to "n" characters back.
- Sort and filter generated strings by length, start, end, and content.
- [Dirichlet prior](https://en.wikipedia.org/wiki/Dirichlet_distribution#Special_cases) parameter.
- Serialization of models and generators to JSON, with runtime-validated deserialization.

## Usage

```ts
import { NameGenerator } from "@ksilvennoinen/markov-namegen";

const data = ["lots", "of", "words", "to", "learn", "from"];
const namegen = new NameGenerator(data, 3, 0, false);
console.log(namegen.generateName({ minLength: 5, maxLength: 11 }));
```

Pass a fifth constructor argument to control randomness. This is useful for reproducible output and tests.

```ts
const reproducible = new NameGenerator(data, 3, 0, false, () => 0.5);
```

Individual calls can also override the random source, which takes precedence over the bound source for that call. This makes per-entity seeded randomness straightforward: pass each entity's own random source to `generateName`/`generateNames` as the `random` option (or the trailing parameter in the positional form), with no shared mutable state.

```ts
namegen.generateName({ minLength: 5, maxLength: 11, random: entityRandom });
```

The positional `generateName` and `generateNames` forms remain supported for compatibility. Named options are also available for batch generation:

```ts
console.log(
	namegen.generateNames(20, {
		minLength: 5,
		maxLength: 11,
		startsWith: "",
		maxTimePerName: 200,
	}),
);
```

The `maxTimePerName` option is the average time budget per name: generating `n` names is capped at roughly `maxTimePerName * n` milliseconds in total.

or if you want to generate a lot of names in one go

```ts
console.log(namegen.generateNames(20, 5, 11, "", "", "", ""));
```

For training data and word lists, see [the original project's `word_lists` folder](https://github.com/Tw1ddle/markov-namegen-lib/tree/master/word_lists).

## Serialization

Generators and models can be serialized to plain JSON-serializable objects and rebuilt later. The random source cannot be serialized, so it is supplied when deserializing (defaulting to `Math.random`).

```ts
import { Generator } from "@ksilvennoinen/markov-namegen";

const generator = new Generator(data, 3, 0.1, true);
const json = JSON.stringify(generator); // toJSON returns the serialized form

const revived = Generator.deserialize(JSON.parse(json));
revived.generate(12); // with the same random source, output matches the original
```

`serialize()` returns an object typed as `SerializedGenerator` (or `SerializedModel` for a single `Model`) rather than a string, so it can also be stored directly in databases or passed to `structuredClone`. `deserialize` takes `unknown`, validates the whole payload at runtime, and throws a descriptive error on malformed input. The format is self-describing: `format` distinguishes generator payloads from model payloads, and `version` will be bumped if the format ever changes.

Since format version 2, chains are stored as sparse `[symbol index, count]` pairs instead of dense cumulative weights, making payloads roughly an order of magnitude smaller — generation is unaffected, as the dense chains are rebuilt on deserialization. Version 1 payloads (from 2.1.0) are still accepted by `deserialize()`. For storage and transfer, the JSON also compresses well with gzip.

## Notes

- Calling `generate()` on a `Generator` without a `maxLength` can loop indefinitely when no reachable context predicts the `#` terminator, which is possible with a `prior` of 0 and cyclic training data. Pass a `maxLength`, or use `NameGenerator`, which always bounds generation.
- The low-level `Generator.generate()` returns the word including its leading boundary markers (one `#` per order), e.g. `"##ab"` for order 2. `NameGenerator` strips them before applying its constraints.
- The original Haxe implementation [can target Javascript](https://haxe.org/manual/target-javascript.html), so both of these can ultimately compile/transpile down to that. So if you are just looking for a JavaScript implementation, you might want to use the original instead.

## License

Distributed under the MIT License. See `LICENSE` for more information.
