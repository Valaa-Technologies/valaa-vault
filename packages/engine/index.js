// @flow

import ContentAPI from "./EngineContentAPI";

const valos = require("~/gateway-api/valos").default;

export default valos.exportPlugin({ name: "@valos/engine", ContentAPI });


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
