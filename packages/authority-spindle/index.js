const packageJSON = require("./package");
const valosheath = require("~/gateway-api/valosheath").default;

module.exports = valosheath.exportSpindle({
  name: packageJSON.name,
  meta: { url: typeof __dirname !== "undefined" ?  __dirname : "" },

  ContentAPI: undefined,
  schemeModules: [],
  authorityConfigs: [],
  mediaDecoders: [],

  "@valos/web-spindle": {
    getProjectors () { return require("./projectors"); }
  },

  attachSpawn (gateway, revelation) {
    return Object.assign(Object.create(this), { gateway, revelation });
  },

  onGatewayInitialized (/* gateway */) {
    // throw new Error(`${this.name}.prototype.onGatewayInitialized not implemented`);
  },

  onViewAttached (/* view, viewName */) {
    // throw new Error(`${this.name}.prototype.onViewAttached not implemented`);
  },
});
