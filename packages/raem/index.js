// @flow

import ContentAPI from "./RAEMContentAPI";

const Valaa = require("~/gateway-api/Valaa").default;

export default Valaa.exportPlugin({ name: "@valos/raem", ContentAPI });


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
                           default as ValaaReference,
                                      vRef,
} from "./ValaaReference";
export type {
  VRef,
} from "./ValaaReference";
export type {
                                      ValaaURI,
} from "./ValaaURI";
export {
                                      getNaivePartitionRawIdFrom,
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
