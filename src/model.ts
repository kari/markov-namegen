/**
 * A Markov model built using string training data.
 */
class Model {
     /**
     * The order of the model i.e. how many characters this model looks back.
     */
    private _order: number;
    /**
     * Dirichlet prior, like additive smoothing, increases the probability of any item being picked.
     */
    private _prior: number;
    /**
     * The alphabet of the training data.
     */
    private _alphabet: string[];
    /**
     * The observations.
     */
    private _observations;
    /**
     * The Markov chains.
     */
    private _chains;

    /**
     * Creates a new Markov model.
     * @param   data    The training data for the model, an array of words.
     * @param   order   The order of model to use, models of order "n" will look back "n" characters within their context when determining the next letter.
     * @param   prior   The dirichlet prior, an additive smoothing "randomness" factor. Must be in the range 0 to 1.
     * @param   alphabet    The alphabet of the training data i.e. the set of unique symbols used in the training data.
     */
    constructor(data: string[], order:number, prior:number, alphabet: string[]) {
        // FIXME: assertions

        this._order = order;
        this._prior = prior;
        this._alphabet = alphabet;

        
    }


}

export { Model }
