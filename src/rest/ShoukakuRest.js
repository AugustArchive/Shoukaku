const Fetch = require('node-fetch');
const Abort = require('abort-controller');
const ShoukakuTimeout = require('../constants/ShoukakuTimeout.js');
const ShoukakuError = require('../constants/ShoukakuError.js');
const Search = {
    'soundcloud': 'scsearch',
    'youtube': 'ytsearch'
};
const Success = ['TRACK_LOADED', 'PLAYLIST_LOADED', 'SEARCH_RESULT'];
/**
 * ShoukakuRest, provides access to Lavalink REST API.
 * @class ShoukakuRest
 */
class ShoukakuRest {
    /**
     * @param {string} host Your node host / ip address of where the lavalink is hosted.
     * @param {string} port The Port Number of your lavalink instance.
     * @param {string} auth The authentication key you set on your lavalink config.
     * @param {number} timeout Timeout before a request times out.
     */
    constructor(host, port, auth, timeout) {
        /**
        * URL of the host used by this resolver instance.
        * @type {string}
        */
        this.url = `http://${host}:${port}/`;
        /**
         * This Resolver Timeout before it decides to cancel the request.
         * @type {number}
         */
        this.timeout = timeout || 10000;

        Object.defineProperty(this, 'auth', { value: auth });
    }
    /**
    * Resolves a identifier into a lavalink track.
    * @param {string} identifier Anything you want for lavalink to search for
    * @param {string} search Either `youtube` or `soundcloud`. If specified, resolve will return search results.
    * @memberof ShoukakuRest
    * @returns {Promise<Object>} The Lavalink Track Object.
    */
    async resolve(identifier, search) {
        if (!identifier)
            throw new ShoukakuError('Query cannot be null');
        if (search) {
            search = Search[search];
            if (!search) throw new ShoukakuError('This search type is not supported');
            identifier = `${search}:${identifier}`;
        }
        const data = await this._getFetch(`/loadtracks?${new URLSearchParams({ identifier }).toString()}`);
        if (!Success.includes(data.loadType)) return null;
        if (data.loadType === 'PLAYLIST_LOADED') {
            data.tracks.name = data.playlistInfo.name;
            return data.tracks;
        }
        if (data.loadType === 'TRACK_LOADED') {
            return data.tracks[0];
        }
        if (data.loadType === 'SEARCH_RESULT') {
            return data;
        }
    }
    /**
     * Decodes the given base64 encoded track from lavalink.
     * @param {base64} track Base64 Encoded Track you got from the Lavalink API.
     * @memberof ShoukakuRest
     * @returns {Promise<Object>} The Lavalink Track details.
     */
    decode(track) {
        if (!track)
            throw new ShoukakuError('Track cannot be null');
        return this._getFetch(`/decodetrack?${new URLSearchParams({ track }).toString()}`);
    }
    /**
     * Gets the status of the "RoutePlanner API" for this Lavalink node.
     * @memberof ShoukakuRest
     * @returns {Promise<JSON>} Refer to `https://github.com/Frederikam/Lavalink/blob/master/IMPLEMENTATION.md#routeplanner-api`
     */
    getRoutePlannerStatus() {
        return this._getFetch('/routeplanner/status');
    }
    /**
     * Unmarks a failed IP in the "RoutePlanner API" on this Lavalink node.
     * @param {string} address The IP you want to unmark as failed.
     * @memberof ShoukakuRest
     * @returns {Promise<number>} Request status code
     */
    unmarkFailedAddress(address) {
        return this._postFetch('/routeplanner/free/address', { address });
    }
    /**
     * Unmarks all the failed IP(s) in the "RoutePlanner API" on this Lavalink node.
     * @memberof ShoukakuRest
     * @returns {Promise<number>} Request status code
     */
    unmarkAllFailedAddress() {
        return this._postFetch('/routeplanner/free/all');
    }

    _getFetch(endpoint) {
        const controller = new Abort();
        const timeout = setTimeout(() => controller.abort(), this.timeout);
        return Fetch(this.url + endpoint, { headers: { Authorization: this.auth }, signal: controller.signal })
            .then((res) => {
                if (!res.ok)
                    throw new ShoukakuError(`Rest request failed with response code: ${res.status}`);
                return res.json();
            })
            .catch((error) => {
                if (error.name === 'AbortError') error = new ShoukakuTimeout(`Rest request timed out. Took more than ${Math.round(this.timeout / 1000)}s to resolve`);
                throw error;
            })
            .finally(() => clearTimeout(timeout));
    }

    _postFetch(endpoint, body) {
        const controller = new Abort();
        const headerOptions = {};
        Object.defineProperty(headerOptions, 'Authorization', { value: this.auth, enumerable: true });
        if (body) Object.defineProperty(headerOptions, 'Content-Type', { value: 'application/json', enumerable: true });
        const options = {};
        Object.defineProperty(options, 'method', { value: 'POST', enumerable: true });
        Object.defineProperty(options, 'headers', { value: headerOptions, enumerable: true });
        Object.defineProperty(options, 'signal', { value: controller.signal, enumerable: true });
        if (body) Object.defineProperty(options, 'body', { value: JSON.stringify(body), enumerable: true });
        const timeout = setTimeout(() => controller.abort(), this.timeout);
        return Fetch(this.url + endpoint, options)
            .then((res) => {
                if (!res.ok)
                    throw new ShoukakuError(`Rest request failed with response code: ${res.status}`);
                return res.status;
            })
            .catch((error) => {
                if (error.name === 'AbortError') error = new ShoukakuTimeout(`Rest request timed out. Took more than ${Math.round(this.timeout / 1000)}s to resolve`);
                throw error;
            })
            .finally(() => clearTimeout(timeout));
    }
}
module.exports = ShoukakuRest;
