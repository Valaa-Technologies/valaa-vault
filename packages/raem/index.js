// @flow

import ContentAPI from "./RAEMContentAPI";

export const valosheath = require("~/gateway-api/valosheath").default;

export default valosheath.exportSpindle({
  name: "@valos/raem", ContentAPI,
  meta: { url: typeof __dirname !== "undefined" ?  __dirname : "" },
});


export {
                                      ContentAPI,
                        ContentAPI as RAEMContentAPI,
};
export type {
                                      Passage,
                                      Story,
} from "./redux/Bard";
export {
                                      getActionFromPassage,
} from "./redux/Bard";
export {
                           default as Corpus,
} from "./Corpus";
export {
                           default as Action,
                                      Command,
                                      Truth,
                                      EventBase,
} from "./events/Action";
export {
                           default as VRL,
                                      vRef,
} from "./VRL";
export type {
                                      ValaaURI,
} from "./ValaaURI";
export {
                                      genericURI,
                                      naiveURI,
} from "./ValaaURI";
export {
                           default as VALK
} from "./VALK/VALK";
export type {
                                      VALKOptions
} from "./VALK/Valker";
export {
                           default as Valker,
                                      run,
} from "./VALK/Valker";
