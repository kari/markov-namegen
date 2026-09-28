# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2026-09-28

### Added

- Serialization support: `Model`, `Generator`, and `NameGenerator` expose `serialize()`, `toJSON()`, and `static deserialize()` for round-tripping trained models through plain JSON. The random source cannot be serialized and is supplied when deserializing. Deserialized payloads are validated at runtime, and malformed input throws a descriptive error.
- `Model` is now part of the public API, together with the `SerializedModel` and `SerializedGenerator` payload types.
- `engines` field declaring Node.js >= 20.

### Changed

- Build output now targets ES2022 (up from ES2021) with `nodenext` module resolution.
- Documented that `Generator.generate()` without a `maxLength` can loop indefinitely when no reachable context predicts the `#` terminator, and that it returns words with their leading boundary markers (`NameGenerator` strips them).
- Documented `maxTimePerName` as what it actually is: the average time budget per name, with a total budget of `maxTimePerName * n` for `n` names.

### Fixed

- Duplicate symbols in a `Model` alphabet are now rejected instead of being silently double-weighted in the Markov chains.
- The `Model` constructor now rejects non-array alphabets and multi-code-point alphabet symbols with clear validation errors.

## [2.0.0] - 2026-09-10

### Changed

- ESM-only package: CommonJS consumers should use a native `import` or dynamic `import()` (plain `require()` also works on Node 22.12+).
- Enhanced TypeScript support with stricter validation of training data, model configuration, generation constraints, and random sources.
- Refactored `Model` internals: readonly properties and a count map for chain building.
