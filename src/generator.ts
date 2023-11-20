import { Model } from "./model";

/**
 * A procedural word generator that uses Markov chains built from a user-provided array of words.
 *
 * This uses Katz's back-off model, which is an approach that uses high-order models. It looks for the next letter based on the last "n" letters, backing down to lower order models when higher models fail.
 *
 * This also uses a Dirichlet prior, which acts as an additive smoothing factor, introducing a chance for random letters to be be picked.
 *
 * @see http://www.samcodes.co.uk/project/markov-namegen/
 * @see https://en.wikipedia.org/wiki/Katz%27s_back-off_model
 * @see https://en.wikipedia.org/wiki/Additive_smoothing
 */

class Generator {
    /**
     * The highest order model used by this generator.
     *
     * Generators own models of order 1 through order "n".
     * Generators of order "n" look back up to "n" characters when choosing the next character.
     */
    order: number;
    /**
     * Dirichlet prior, acts as an additive smoothing factor.
     *
     * The prior adds a constant probability that a random letter is picked from the alphabet when generating a new letter.
     */
    prior: number;
    /**
     * Whether to fall back to lower orders of models when a higher-order model fails to generate a letter.
     */
    backoff: boolean;
    /**
     * The array of Markov models used by this generator, starting from highest order to lowest order.
     */
    models: Model[];

    /**
     * Creates a new procedural word Generator.
     * @param   data    Training data for the generator, an array of words.
     * @param   order   Highest order of model to use - models of order 1 through order will be generated.
     * @param   prior   The dirichlet prior/additive smoothing "randomness" factor.
     * @param   backoff Whether to fall back to lower order models when the highest order model fails to generate a letter.
     */
    constructor(data: string[], order:number, prior:number, backoff:boolean) {
        // FIXME: assertions

        this.order = order;
        this.prior = prior;
        this.backoff = backoff;

        const letters = new Set<string>();
        for (const word in data) {
            for (const letter of word) {
                letters.add(letter);
            }
        }
        
        const domain = [...letters].sort(function(a:string, b:string) {
            if (a < b) {
                return -1;
            }
            if (a > b) {
                return 1;
            }
            return 0;
        });
        domain.unshift("#");

        const models: Model[] = [];
        if (this.backoff) {
            for (let i = 0; i <= order; i++) {
                models.push(new Model(data, order - i, prior, domain)); // from highest to lowest order
            }
        } else {
            models.push(new Model(data, order, prior, domain));
        }

    }
}

export { Generator }
