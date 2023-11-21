# markov-namegen

This is a TypeScript port of [markov-namegen-lib](https://github.com/Tw1ddle/markov-namegen-lib). It is a Markov chain based name or word generator library.

## Features

Offers most of the features available in the reference Haxe implementation

- [Katz backoff](https://en.wikipedia.org/wiki/Katz%27s_back-off_model) using high order models - look up to "n" characters back.
- Sort and filter generated strings by length, start, end, and content.
- [Dirichlet prior](https://en.wikipedia.org/wiki/Dirichlet_distribution#Special_cases) parameter.

## Usage

```ts
const data = ["lots", "of", "words", "to", "learn", "from"];
const namegen = new NameGenerator(data, 3, 0, false);
console.log(namegen.generate(5, 11, "", "", "", ""));
```

or if you want to generate a lot of names in one go

```ts
console.log(namegen.generateNames(20, 5, 11, "", "", "", ""))
```

For training data and word lists, see [the original project's `word_lists` folder](https://github.com/Tw1ddle/markov-namegen-lib/tree/master/word_lists).

## Notes

- The original Haxe implementation [can target Javascript](https://haxe.org/manual/target-javascript.html), so both of these can ultimately compile/transpile down to that. So if you are just looking for a JavaScript implementation, you might want to use the original instead.

## License

Distributed under the MIT License. See `LICENSE` for more information.
