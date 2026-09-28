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

## Notes

- Calling `generate()` on a `Generator` without a `maxLength` can loop indefinitely when no reachable context predicts the `#` terminator, which is possible with a `prior` of 0 and cyclic training data. Pass a `maxLength`, or use `NameGenerator`, which always bounds generation.
- The low-level `Generator.generate()` returns the word including its leading boundary markers (one `#` per order), e.g. `"##ab"` for order 2. `NameGenerator` strips them before applying its constraints.
- The original Haxe implementation [can target Javascript](https://haxe.org/manual/target-javascript.html), so both of these can ultimately compile/transpile down to that. So if you are just looking for a JavaScript implementation, you might want to use the original instead.

## License

Distributed under the MIT License. See `LICENSE` for more information.
