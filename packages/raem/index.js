// @flow

import exportValaaPlugin from "~/tools/exportValaaPlugin";

import ContentAPI from "./RAEMContentAPI";

export default exportValaaPlugin({ name: "@valos/raem", ContentAPI });


export {
                                      ContentAPI,
                        ContentAPI as RAEMContentAPI,
};
export {
                                      Passage,
                                      Story,
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
