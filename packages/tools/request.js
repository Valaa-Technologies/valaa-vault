import wrapError, { inBrowser } from "~/tools/wrapError";

/**
 * Wraps reqest in a real promise
 */
export default function (opts) { return asyncRequest(opts); }

const outstandingRequests = {};

let reqwest;

async function asyncRequest (opts) {
  if (!reqwest) {
    if (!inBrowser) {
      document = global.document;
      opts.crossOrigin = true;

    }
    reqwest = require("reqwest");
  }
  try {
    if (!opts.url) throw new Error(`request call missing opts.url`);
    // console.log("requesting", opts.url);
    let silentMode = false;
    if (opts.silent === true) {
      silentMode = true;
      delete opts.silent;
    }
    console.info("reqwest promise created", opts);
    outstandingRequests[opts.url] = opts;
    const ret = await new Promise((resolve, reject) => {
      reqwest({
        ...opts,
        success: (response, ...params) =>
            resolve(response && (typeof response === "object")
                    && (typeof response.responseText !== "undefined")
                        ? response.responseText
                        : response,
                response, ...params),
        error: (response, reqwestError, underlyingError) => {
          if (!silentMode) {
            const optsLength = JSON.stringify(opts).length;
            let filteredOpts;
            if (optsLength > 2000) {
              filteredOpts = Object.keys(opts).reduce((prev, key) => {
                const keyLength = JSON.stringify(opts[key]).length;
                if (keyLength > 1000) {
                  prev[key] = `[VALUE TOO LARGE (size ${keyLength})]`;
                } else {
                  prev[key] = opts[key];
                }
                return prev;
              }, {});
            } else {
              filteredOpts = opts;
            }
            console.error("Resource request rejected\n- opts:\n", filteredOpts, "\n- reply:\n",
                response, "\n - response:\n", response);
          }
          return reject(wrapError(underlyingError
                  || new Error(`Error while downloading "${opts.url}": ${reqwestError}`),
              `During asyncRequest("${opts.url}"): ${response.status} ${response.statusText}`,
              "\n\twith reqwest error:", reqwestError,
              "\n\tresponse.responseText:", response && response.responseText,
              "\n\tresponse:", response,
          ));
        },
      });
    });
    delete outstandingRequests[opts.url];
    console.info("reqwest promise resolved", opts, { content: ret }, outstandingRequests);
    return ret;
  } catch (error) {
    throw wrapError(error, `During request(${opts.url}), with:`,
        "\n\topts:", opts,
    );
  }
}
