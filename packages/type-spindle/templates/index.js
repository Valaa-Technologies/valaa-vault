const packageJSON = require("./package");
const valosheath = require("~/gateway-api/valosheath").default;

export default valosheath.exportSpindle({
  name: packageJSON.name,

  schemeModules: [],
  authorityConfigs: [],
  mediaDecoders: [],

  attachSpawn (gateway, spindleRevelation) {
    return Object.assign(Object.create(this), { gateway, revelation: spindleRevelation });
  },

  onGatewayInitialized (/* gateway */) {
    throw new Error(`${this.name}.onGatewayInitialized not implemented`);
  },

  onViewAttached (/* view, viewName */) {
    throw new Error(`${this.name}.onViewAttached not implemented`);
  },
});
