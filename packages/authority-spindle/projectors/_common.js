import valosheath from "@valos/gateway-api/valosheath";

const { dumpObject } = valosheath.require("@valos/tools");

export function _prepareChronicleRequest (router, projector, request, reply) {
  router.infoEvent(1, () => [`${projector.name}:`,
    "\n\trequest.params:", ...dumpObject(request.params),
    "\n\trequest.query:", ...dumpObject(request.query),
    "\n\trequest.cookies:", ...dumpObject(Object.keys(request.cookies || {})),
  ]);

  const valkOptions = router.buildRuntimeVALKOptions(projector, projector.runtime, request, reply);
  if (router.presolveRulesToScope(projector.runtime, valkOptions)) {
    router.warnEvent(1, () =>
        [`RUNTIME RULE FAILURE in ${router._routeName(this.runtime.route)}.`]);
    return null;
  }

  const scope = valkOptions.scope;
  const discourse = router.getDiscourse();
  const chronicleURI = _getChronicleURIFromRoutePlot(
      discourse, scope.authorityURI, scope.chroniclePlot);

  scope.connection = discourse.sourcerChronicle(chronicleURI);

  for (const [headerName, headerValue] of Object.entries(valkOptions.scope.headers || {})) {
    reply.header(headerName, headerValue);
  }

  return { valkOptions, scope, discourse, chronicleURI };
}

export function _getChronicleURIFromRoutePlot (discourse, authorityURI, routePlot) {
  try {
    const params = routePlot.split("!");
    if (params.length !== 1) {
      throw new Error(`Invalid chronicle plot id: 1 param expected, got ${params.length}`);
    }
    const [term, suffix] = params[0].split("'");
    if (term[0] !== "~") {
      throw new Error(`Invalid chronicle plot id term: expected "~" as first char, got "${term}"`);
    }
    if (!suffix) {
      throw new Error(`Invalid nully chronicle plot id suffix`);
    }
    return discourse.createChronicleURI(authorityURI, `${term}'${suffix}`);
  } catch (error) {
    throw discourse.wrapErrorEvent(error, 1,
        new Error(`getChronicleURIFromRoutePlot(<${authorityURI}>, "${routePlot}")`));
  }
}
