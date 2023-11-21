import { Generator } from "./generator";

/**
 * An example name generator that builds upon the Generator class. This should be sufficient for most simple name generation scenarios.
 *
 * For complex name generators, modifying the Generator class to your specifications may be more appropriate or performant than extending this approach.
 */
class NameGenerator {
    /**
     * The underlying word generator.
     */
    private _generator: Generator;

    /**
     * Creates a new procedural name generator.
     * @param   data    Training data for the generator, an array of words.
     * @param   order   Highest order of model to use - models 1 to order will be generated.
     * @param   prior   The dirichlet prior/additive smoothing "randomness" factor.
     * @param   backoff Whether to fall back to lower order models when the highest order model fails to generate a letter (defaults to false).
     */
    constructor(data: string[], order: number, prior: number, backoff: boolean = false) {
        this._generator = new Generator(data, order, prior, backoff);
    }

    /**
     * Creates a word within the given constraints.
     * If the generated word does not meet the constraints, this returns null.
     * @param   minLength   The minimum length of the word.
     * @param   maxLength   The maximum length of the word.
     * @param   startsWith  The text the word must start with.
     * @param   endsWith    The text the word must end with.
     * @param   includes    The text the word must include.
     * @param   excludes    The text the word must exclude.
     * @return  A word that meets the specified constraints, or null if the generated word did not meet the constraints.
     */
    generateName(minLength: number, maxLength: number, startsWith: string, endsWith: string, includes: string, excludes: string): string | null {
        let name: string;

        name = this._generator.generate();
        name = name.replace(/#/g, ""); // FIXME: ES2021 gives replaceAll
        
        if (name.length >= minLength && name.length <= maxLength && name.startsWith(startsWith) && name.endsWith(endsWith) && (includes.length == 0 || name.includes(includes)) && (excludes.length == 0 || !name.includes(excludes))) {
            return name;
        }

        return null;
    }

    /**
     * Attempts to generate "n" names that meet the given constraints within an alotted time.
     * @param   n   The number of names to generate.
     * @param   minLength   The minimum length of the word.
     * @param   maxLength   The maximum length of the word.
     * @param   startsWith  The text the word must start with.
     * @param   endsWith    The text the word must end with.
     * @param   includes    The text the word must include.
     * @param   excludes    The text the word must exclude.
     * @param   maxTimePerName  The maximum time in milliseconds to spend generating each name.
     * @return  A word that meets the specified constraints, or null if no word that met the constraints was generated in the time alotted.
     */
    generateNames(n: number, minLength: number, maxLength: number, startsWith: string, endsWith: string, includes: string, excludes: string, maxTimePerName: number = 200): string[] {
        const names = new Array<string>();

        const startTime = performance.now();
        let currentTime = performance.now();

        while (names.length < n && currentTime < startTime + (maxTimePerName * n)) {
            const name = this.generateName(minLength, maxLength, startsWith, endsWith, includes, excludes);
            if (name != null) {
                names.push(name);
            }

            currentTime = performance.now();
        }

        return names;
    }


}

export { NameGenerator }
