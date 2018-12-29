// @flow

import Valaa from "~/tools/Valaa";

import ContentAPI from "./ScriptContentAPI";
import * as mediaDecoders from "./mediaDecoders";

export default Valaa.exportPlugin({ name: "@valos/script", ContentAPI, mediaDecoders });


export {
                                      ContentAPI,
                        ContentAPI as ScriptContentAPI
};
export {
                           default as transpileValaaScript,
                                      transpileValaaScriptBody,
                                      transpileValaaScriptModule,
} from "./transpileValaaScript";
export {
                           default as addExportsContainerToScope
} from "./denormalized/addExportsContainerToScope";
export {
                                      NativeIdentifierTag,
                                      createNativeIdentifier,
                                      isNativeIdentifier,
                                      getNativeIdentifierValue,
                                      setNativeIdentifierValue,
} from "./denormalized/nativeIdentifier";
export {
                                      BuiltinTypePrototype,
                                      ValaaPrimitiveTag,
} from "./VALSK/builtinSteppers";
