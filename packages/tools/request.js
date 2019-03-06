// @flow

import { inBrowser, getGlobal, thenChainEagerly, wrapError } from "~/tools";

export default function (opts) { return asyncRequest(opts); }

const _cache = {};

function asyncRequest ({ input, fetch: fetchOpts }) {
  return _cache[input] || (_cache[input] = thenChainEagerly({ fetch: { ...(fetchOpts || {}) } }, [
    state => {
      const fetch = getGlobal().fetch;
      if (!fetch) {
        throw new Error(`window/global.fetch is missing; if running in a non-browser ${
            ""}environment please execute through perspire gateway (or similar)`);
      }
      if (!input) throw new Error(`missing request.input`);
      if (!inBrowser() && (state.fetch.crossOrigin === undefined)) {
        state.fetch.crossOrigin = false;
      }
      return fetch(input, state.fetch);
    },
    response => {
      if (response.status >= 400) {
        const error = new Error(`fetch response ${response.status} for ${
          (fetchOpts || {}).method || "GET"} ${input}: ${response.statusText}`);
        error.response = response;
        throw error;
      }
      return response.json();
    },
    json => {
      delete _cache[input];
      return json;
    },
  ], function errorOnAsyncRequest (error) {
    delete _cache[input];
    throw wrapError(error, `During request(${input}), with:`,
        "\n\tfetchOptions:", fetchOpts,
    );
  }));
}
