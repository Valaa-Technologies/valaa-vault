import path from "path";

import Vrapper from "~/engine/Vrapper";

import { thenChainEagerly } from "~/tools/thenChainEagerly";
import { dumpObject } from "~/tools/wrapError";

export function _addResourceProjector (router, projector) {
  const resourceSchema = ((projector.config || {}).resource || {}).schema;
  if (!resourceSchema) return;
  const idParamName = projector.route.url.match(/:([^/]*)/)[1];
  (router._resourceProjectors || (router._resourceProjectors = []))
      .push([_getResourceHRefPrefix(router, resourceSchema), projector, idParamName]);
}

function _findResourceProjector (router, requestURL) {
  for (const projectorInfo of router._resourceProjectors) {
    if (requestURL.slice(0, projectorInfo[0].length) === projectorInfo[0]) return projectorInfo;
  }
  return [];
}

export function _createGetRelSelfHRef (router, runtime, type, resourceSchema) {
  if (!(((resourceSchema || {}).valospace || {}).gate || {}).name) {
    router.errorEvent(
        `Trying to generate a href to a resource without valospace.gate.name:`,
        "\n\truntime:", (runtime || {}).name,
        "\n\tresourceSchema:", ...dumpObject(resourceSchema, { nest: true }),
        "\n\tSKIPPING FIELD");
    return undefined;
  }
  const prefix = _getResourceHRefPrefix(router, resourceSchema);
  const ret = (resources/* , scope */) =>
      path.posix.join(prefix,
          ...[].concat(resources).map(v => (!(v instanceof Vrapper) ? v : v.getRawId())));
  if (type) runtime[type] = ret;
  return ret;
}

export function _getResourceHRefPrefix (router, maybeResourceSchema) {
  const resourceSchema = router.derefSchema(maybeResourceSchema);
  const routeName = ((resourceSchema.valospace || {}).gate || {}).name;
  if (typeof routeName !== "string") {
    throw new Error("href requested of a resource without a valospace.gate.name");
  }
  return path.posix.join("/", router.getRoutePrefix(), routeName, "/");
}

export function _relRequest (router, rel, requestOptions) {
  if (rel !== "self") {
    return { statusCode: 501, payload: "Only 'rel: self' nested expansions supported" };
  }
  const [prefix, selfProjector, idParamName] =
      _findResourceProjector(router, requestOptions.url);
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
          sendLoopbackContent (payloadJSON) {
            if (!response.statusCode) response.statusCode = 200;
            response.payloadJSON = payloadJSON;
          },
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
