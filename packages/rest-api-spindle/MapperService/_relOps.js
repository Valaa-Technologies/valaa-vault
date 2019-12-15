import { thenChainEagerly } from "~/tools/thenChainEagerly";

export function _addResourceProjector (router, route, projector) {
  const resourceSchema = ((route.config || {}).resource || {}).schema;
  if (!resourceSchema) return;
  const idParamName = route.url.match(/:([^/]*)/)[1];
  (router._resourceProjectors || (router._resourceProjectors = []))
      .push([router.getResourceHRefPrefix(resourceSchema), projector, idParamName]);
}

export function _relRequest (router, rel, requestOptions) {
  if (rel !== "self") {
    return { statusCode: 501, payload: "Only 'rel: self' nested expansions supported" };
  }
  const [prefix, selfProjector, idParamName] = _findSelfProjector(router, requestOptions.url);
  if (selfProjector) {
    /*
    console.log("self-projector found:", prefix,
        "\n\tself-rel request:", requestOptions.url,
        `\n\t${idParamName}:`, requestOptions.url.slice(prefix.length),
    );
    */
    const response = {};
    return thenChainEagerly(
        selfProjector.smartHandler({
          // request
          params: { [idParamName]: requestOptions.url.slice(prefix.length) },
          cookies: requestOptions.cookies,
          query: requestOptions.query,
        }, {
          // reply
          code (statusCode) { response.statusCode = statusCode; },
          sendJSON (payloadJSON) { response.payloadJSON = payloadJSON; },
          send (payload) { response.payload = payload; },
        }),
        () => response);
  }
  requestOptions.headers = { ...(requestOptions.headers || {}) };
  if (requestOptions.cookies) {
    requestOptions.headers.Cookie = Object.entries(requestOptions.cookies)
        .map(([cookie, content]) => `${cookie}=${content}`)
        .join("; ");
    delete requestOptions.cookies;
  }
  // So this is not exactly kosher. To implement expansion of
  // nested properties we make virtual GET requests using the
  // projection API which is primarily intended for testing and
  // incurs full request overheads for each call. On the other
  // hand, this is simple, complete and way more efficient than
  // having clients make separate queries for the entries.
  return router.getRootFastify()
      .inject(requestOptions);
}

export function _replySendJSON (router, reply, payloadJSON) {
  if (reply.sendJSON) {
    reply.sendJSON(payloadJSON);
  } else {
    reply.send(JSON.stringify(payloadJSON, null, 2));
  }
}

function _findSelfProjector (router, requestURL) {
  for (const projectorInfo of router._resourceProjectors) {
    if (requestURL.slice(0, projectorInfo[0].length) === projectorInfo[0]) return projectorInfo;
  }
  return [];
}
