// @flow

import exportValaaPlugin from "~/tools/exportValaaPlugin";

import ContentAPI from "./RAEMContentAPI";

export default exportValaaPlugin({ name: "@valos/raem", ContentAPI });


export {
                                      ContentAPI,
                        ContentAPI as RAEMContentAPI,
};
export {
                           default as Corpus,
} from "./Corpus";
export {
                           default as Command,
} from "./command/Command";
export {
                           default as ValaaReference,
                                      VRef,
                                      vRef,
} from "./ValaaReference";
export {
                           default as ValaaURI,
} from "./ValaaURI";
export {
                           default as VALK
} from "./VALK/VALK";
export {
                           default as Valker,
                                      run,
} from "./VALK/Valker";
