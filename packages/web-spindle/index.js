// @flow

import * as projectors from "./projectors";

const valosheath = require("~/gateway-api/valosheath").default;

const MapperService = require("./MapperService").default;

export default valosheath.exportSpindle({
  name: "@valos/web-spindle",

  async onGatewayInitialized (gateway, { server, prefixes }) {
    const { expose } = gateway.valosRequire("@valos/inspire");
    if (!server) throw new Error(`${this.name} revelation server section missing`);
    if (!prefixes) throw new Error(`${this.name} revelation prefixes section missing`);
    this._prefixRouters = {};
    const plog = gateway.opLog(1, "web-spindle",
        "Creating web-spindle", { server, prefixes });
    this._service = new MapperService(
        gateway, { identity: valosheath.identity, ...server }, projectors);
    const rplog1 = this._service.opLog(1, plog, "prefixes",
        "Adding routers for prefixes", prefixes);
    return Promise.all(Object.entries(prefixes).map(async ([prefix, prefixConfig]) =>
        this._addPrefixRouter(gateway, prefix, await expose(prefixConfig), rplog1)));
  },

  getWebService () { return this._service; },

  async onGatewayTerminating () {
    return this._service.stop();
  },

  async _addPrefixRouter (gateway, prefix, prefixConfig, parentPlog) {
    const { dumpObject } = gateway.valosRequire("@valos/tools");
    try {
      const viewConfig = prefixConfig.view;
      const viewName = (
              (typeof viewConfig === "string")
                  ? viewConfig
              : (typeof viewConfig !== "object")
                  ? "host"
              : viewConfig.name)
          || `${this.name}:view:${prefix}`;
      const plog1 = this._service.opLog(1, parentPlog, prefix,
          `Creating prefix router to <${prefix}>`, prefixConfig);

      this._prefixRouters[viewName] = this._service.createPrefixRouter(prefix, prefixConfig, plog1);
      if (typeof viewConfig === "object") {
        const vplog1 = gateway.opLog(1, plog1, `addView`,
            `Adding view for prefixRouter <${prefix}>: ${viewName}`, viewConfig);
        const view = await gateway.addView(viewName, {
          contextLensProperty: ["WEB_LENS", "LENS"],
          lensProperty: ["WEB_API_LENS", "LENS"],
          ...viewConfig,
        }, vplog1);
        vplog1 && vplog1.opEvent("done",
            `Added view for prefixRouter <${prefix}> as "${viewName}"`,
            { viewConfig, view });
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

  async onViewAttached (view, viewName) {
    if (!this._prefixRouters[viewName]) return undefined;
    return this._prefixRouters[viewName]
        .projectFromView(view, viewName)
        .then(() => this._service.start());
  },
});
