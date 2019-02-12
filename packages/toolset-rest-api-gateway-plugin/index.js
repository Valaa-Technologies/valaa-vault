// @flow

const Valaa = require("~/tools").Valaa;

export default Valaa.exportPlugin({
  name: "@valos/toolset-rest-api-gateway-plugin",

  onViewAttached (view, viewName) {
    const RestAPIServer = require("./fastify/RestAPIServer").default;
    const { port, address, prefix, mappings } =
        require(`${process.cwd()}/toolsets.json`)[this.name];
    const { schemas, routes } = (typeof mappings === "string") ? require(mappings) : mappings;
    const gateway = view._gateway;
    const options = {
      view, viewName, gateway, logger: gateway.getLogger(), port, address, prefix, schemas, routes,
    };
    view._restAPIServer = new RestAPIServer(options);
    return view._restAPIServer.start();
  },
});
