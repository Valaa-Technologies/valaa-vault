// @flow

import { inBrowser, getGlobal, thenChainEagerly, wrapError } from "~/tools/wrapError";

export default function (opts) { return asyncRequest(opts); }

const fetchingCache = {};

function asyncRequest (options) {
  return fetchingCache[options.input] || (fetchingCache[options.input] = thenChainEagerly(options, [
    ({ input, ...rest }) => {
      const fetch = getGlobal().fetch;
      if (!fetch) {
        throw new Error(`window/global.fetch is missing; if running in a non-browser ${
            ""}environment please execute through perspire gateway (or similar)`);
      }
      if (!input) throw new Error(`missing options.input`);
      if (!inBrowser()) {
        rest.crossOrigin = false;
      }
      return fetch(input, rest);
    },
    response => response.json(),
    json => {
      delete fetchingCache[options.input];
      return json;
    },
  ], function errorOnAsyncRequest (error) {
    delete fetchingCache[options.input];
    throw wrapError(error, `During request(${options.input}), with:`,
        "\n\toptions:", options,
    );
  }));
}
