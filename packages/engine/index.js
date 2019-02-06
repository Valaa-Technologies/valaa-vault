// @flow

import ContentAPI from "./EngineContentAPI";

const Valaa = require("~/gateway-api/Valaa").default;

export default Valaa.exportPlugin({ name: "@valos/engine", ContentAPI });


export {
                                      ContentAPI,
                        ContentAPI as EngineContentAPI,
};
export {
                           default as VALEK,
} from "./VALEK";
export {
                           default as ValaaEngine,
} from "./ValaaEngine";
export {
                           default as Vrapper,
} from "./Vrapper/Vrapper";
