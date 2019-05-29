// @flow

import path from "path";

const valosheath = require("~/gateway-api/valosheath").default;

export default valosheath.exportPlugin({
  name: "@valos/toolset-rest-api-gateway-plugin",

  onViewAttached (view, viewName) {
    const patchWith = require("@valos/tools/patchWith").default;
    const RestAPIServer = require("./fastify/RestAPIServer").default;
    const configRequire = (module) =>
        valosheath.require(path.isAbsolute(module) ? module : path.join(process.cwd(), module));

    const { server, prefixes } = require(`${process.cwd()}/toolsets.json`)[this.name];
    const options = patchWith({
      name: `${viewName} REST API Server`,
      prefixes: {},
    }, server, {
      require: configRequire,
    });
    options.view = view;
    options.viewName = viewName;
    Object.entries(prefixes).forEach(([prefix, { api, extensions }]) => {
      const prefixAPI = options.prefixes[prefix] = patchWith(options.prefixes[prefix] || {}, [
        api,
        ...[].concat(extensions).map(extension => (typeof extension !== "string"
            ? extension
            : require(extension).api)),
      ], {
        require: configRequire,
      });
      if (prefixAPI.identity) {
        prefixAPI.identity = Object.assign(Object.create(valosheath.identity), prefixAPI.identity);
      }
    });
    view._restAPIServer = new RestAPIServer(options);
    return view._restAPIServer.start();
  },
});
