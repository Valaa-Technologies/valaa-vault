// @flow

import * as projectors from "./projectors";

const valosheath = require("~/gateway-api/valosheath").default;

const MapperService = require("./MapperService").default;

export default valosheath.exportSpindle({
  name: "@valos/web-spindle",

  async onGatewayInitialized (gateway, { server, prefixes }) {
    const { lazy } = gateway.require("@valos/inspire");
    if (!server) throw new Error(`${this.name} revelation server section missing`);
    if (!prefixes) throw new Error(`${this.name} revelation prefixes section missing`);
    this._prefixRouters = {};
    this._service = new MapperService(
        gateway, { identity: valosheath.identity, ...server }, projectors);
    gateway.clockEvent(1, () => [
      "restAPISpindle.onGatewayInitialized",
      `Adding routers for prefixes: '${Object.keys(prefixes).join("', '")}'`,
    ]);
    await Promise.all(Object.entries(prefixes).map(async ([prefix, prefixConfig]) =>
        this._addPrefixRouter(gateway, prefix, await lazy(prefixConfig))));
    return this._service.start();
  },

  async onGatewayTerminating () {
    return this._service.stop();
  },

  async _addPrefixRouter (gateway, prefix, prefixConfig) {
    const { dumpObject } = gateway.require("@valos/tools");
    try {
      const viewConfig = prefixConfig.view;
      const viewName = (typeof viewConfig === "string") ? viewConfig
          : (typeof viewConfig === "object") ? `${this.name}:view:${prefix}`
          : "host";

      this._prefixRouters[viewName] = this._service.createPrefixRouter(prefix, prefixConfig);
      if (typeof viewConfig === "object") {
        const view = await gateway.addView(viewName, {
          lensPropertyFallbacks: ["WEB_API_LENS"],
          ...viewConfig,
          lensURI: viewConfig.focus,
        });
        view.clockEvent(1, () => [
          `web-spindle.addView.done`,
          `Added view for prefixRouter ${prefix}: ${viewName}`,
          ...(!gateway.getVerbosity() ? [] : [", with:",
            "\n\tviewConfig:", ...dumpObject(viewConfig),
          ]),
        ]);
      }
    } catch (error) {
      gateway.outputErrorEvent(
          gateway.wrapErrorEvent(error, 1,
              new Error(`web-spindle:addPrefixRouter(${prefix}`),
              "\n\tprefixConfig:", ...dumpObject(prefixConfig)),
          `Exception caught during web-spindle:addPrefixRouter(${prefix}):${
            ""}\n\n\n\tROUTER NOT ADDED FOR PREFIX: ${prefix}\n\n`);
    }
  },

  onViewAttached (view, viewName) {
    return this._prefixRouters[viewName]
        && this._prefixRouters[viewName].projectFromView(view, viewName);
  },
});
