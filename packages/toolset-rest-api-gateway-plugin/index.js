// @flow

const valos = require("~/tools").valos;

export default valos.exportPlugin({
  name: "@valos/toolset-rest-api-gateway-plugin",

  onViewAttached (view, viewName) {
    const deepExtend = require("@valos/tools/deepExtend").default;
    const RestAPIServer = require("./fastify/RestAPIServer").default;

    const { server, prefixes } = require(`${process.cwd()}/toolsets.json`)[this.name];
    const options = {
      name: `${viewName} REST API Server`,
      prefixes: {},
      ...server,
      view, viewName,
    };
    Object.entries(prefixes).forEach(([prefix, { api, extensions }]) => {
      options.prefixes[prefix] = deepExtend(options.prefixes[prefix] || {}, [
        api,
        ...[].concat(extensions).map(extension => (typeof extension !== "string"
            ? extension
            : require(extension).api)),
      ]);
    });
    view._restAPIServer = new RestAPIServer(options);
    return view._restAPIServer.start();
  },
});
