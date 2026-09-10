# markov-namegen

This is a TypeScript port of [markov-namegen-lib](https://github.com/Tw1ddle/markov-namegen-lib). It is a Markov chain based name or word generator library.

The package is ESM-only and requires an environment with native ES modules.
CommonJS consumers should migrate from `require()` to a native `import` or use dynamic `import()`.

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

or if you want to generate a lot of names in one go

```ts
console.log(namegen.generateNames(20, 5, 11, "", "", "", ""));
```

For training data and word lists, see [the original project's `word_lists` folder](https://github.com/Tw1ddle/markov-namegen-lib/tree/master/word_lists).

## Notes

- The original Haxe implementation [can target Javascript](https://haxe.org/manual/target-javascript.html), so both of these can ultimately compile/transpile down to that. So if you are just looking for a JavaScript implementation, you might want to use the original instead.

## License

Distributed under the MIT License. See `LICENSE` for more information.
