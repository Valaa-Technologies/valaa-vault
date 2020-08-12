Object.defineProperty(exports, "__esModule", { value: true });

const getGlobal = require("../gateway-api/getGlobal").default;

const { thenChainEagerly } = require("./thenChainEagerly");
const { wrapError } = require("./wrapError");

const _getCache = {};

exports.default = function fetchJSON (input, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  if ((method === "GET") && _getCache[input]) return _getCache[input];
  const fetchOperation = thenChainEagerly(input, [
    function performFetch () {
      const fetch = getGlobal().fetch;
      if (!fetch) {
        throw new Error(`window/global.fetch is missing; if running in a non-browser ${
            ""}environment please execute through perspire gateway (or similar)`);
      }
      if (!input) throw new Error(`missing fetchJSON input`);
      return fetch(input, !options.body || (typeof options.body !== "object")
          ? options
          : {
            ...options,
            body: JSON.stringify(options.body),
            headers: {
              ...(options.headers || {}),
              "Content-Type": "application/json",
            },
          },
      );
    },
    function extractJSON (response) {
      options.response = response;
      if (response.status >= 400) {
        const error = new Error(
            `fetch response ${response.status} for ${method} ${input}: ${response.statusText}`);
        error.response = response;
        throw error;
      }
      return (response.status === 204)
          ? undefined
          : response.json();
    },
    function clearCache (json) {
      if (method === "GET") delete _getCache[input];
      return json;
    },
  ], function errorOnFetchJSON (error) {
    if (method === "GET") delete _getCache[input];
    throw wrapError(error, `During fetchJSON(${input}), with:`,
        "\n\toptions:", options,
    );
  });
  if (method === "GET") _getCache[input] = fetchOperation;
  return fetchOperation;
};

exports.fetch = function fetch (...rest) {
  return getGlobal().fetch(...rest);
};
