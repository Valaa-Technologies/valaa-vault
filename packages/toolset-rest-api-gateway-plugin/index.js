// @flow

const Valaa = require("~/tools").Valaa;

export default Valaa.exportPlugin({
  name: "@valos/toolset-rest-api-gateway-plugin",

  onViewAttached (view, viewName) {
    const RestAPIServer = require("./fastify/RestAPIServer").default;
    const { port, address, routes } = require(`${process.cwd()}/toolsets.json`)[this.name];
    const actualRoutes = (typeof routes === "string")
        ? require(`${process.cwd()}/${routes}`) : routes;
    view._restAPIServer = new RestAPIServer({
      view, viewName, port, address, routes: actualRoutes,
    });
    view._restAPIServer.start();
  },
});
