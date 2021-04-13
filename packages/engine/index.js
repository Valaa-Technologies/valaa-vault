// @flow

import ContentAPI from "./EngineContentAPI";

export const valosheath = require("~/gateway-api/valosheath").default;

export default valosheath.exportSpindle({
  name: "@valos/engine", ContentAPI,
  meta: { url: typeof __dirname !== "undefined" ?  __dirname : "" },
});

export {
                                      ContentAPI,
                        ContentAPI as EngineContentAPI,
};
export {
                           default as VALEK,
} from "./VALEK";
export {
                           default as Engine,
} from "./Engine";
export {
                           default as Vrapper,
} from "./Vrapper/Vrapper";
