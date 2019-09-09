const packageJSON = require("./package");
const valosheath = require("~/gateway-api/valosheath").default;

export default valosheath.exportSpindle({
  name: packageJSON.name,

  ContentAPI: undefined,
  schemeModules: [],
  authorityConfigs: [],
  mediaDecoders: [],

  attachSpawn (/* gateway */) { return Object.create(this); },

  onGatewayInitialized (/* gateway */) {
    throw new Error(`${this.name}.onGatewayInitialized not implemented`);
  },

  onViewAttached (/* view, viewName */) {
    throw new Error(`${this.name}.onViewAttached not implemented`);
  },
});
