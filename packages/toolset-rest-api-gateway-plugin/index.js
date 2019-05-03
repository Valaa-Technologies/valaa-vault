// @flow

const valosheath = require("~/gateway-api/valosheath").default;

export default valosheath.exportPlugin({
  name: "@valos/toolset-rest-api-gateway-plugin",

  onViewAttached (view, viewName) {
    const deepExtend = require("@valos/tools/deepExtend").default;
    const RestAPIServer = require("./fastify/RestAPIServer").default;

    const { server, prefixes } = require(`${process.cwd()}/toolsets.json`)[this.name];
    const options = deepExtend({
      name: `${viewName} REST API Server`,
      prefixes: {},
    }, server, {
      require: valosheath.require,
    });
    options.view = view;
    options.viewName = viewName;
    Object.entries(prefixes).forEach(([prefix, { api, extensions }]) => {
      const prefixAPI = options.prefixes[prefix] = deepExtend(options.prefixes[prefix] || {}, [
        api,
        ...[].concat(extensions).map(extension => (typeof extension !== "string"
            ? extension
            : require(extension).api)),
      ], {
        require: valosheath.require,
      });
      if (prefixAPI.identity) {
        prefixAPI.identity = Object.assign(Object.create(valosheath.identity), prefixAPI.identity);
      }
    });
    view._restAPIServer = new RestAPIServer(options);
    return view._restAPIServer.start();
  },
});
