// @flow

import ContentAPI from "./ScriptContentAPI";
import * as mediaDecoders from "./mediaDecoders";

const valos = require("~/gateway-api/valos").default;

export default valos.exportPlugin({ name: "@valos/script", ContentAPI, mediaDecoders });


export {
                                      ContentAPI,
                        ContentAPI as ScriptContentAPI
};
export {
                           default as transpileValoscript,
                                      transpileValoscriptBody,
                                      transpileValoscriptModule,
} from "./transpileValoscript";
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
                                      ValoscriptInterface,
                                      ValoscriptNew,
                                      ValoscriptPrimitive,
                                      ValoscriptPrimitiveKind,
                                      ValoscriptPrototype,
                                      ValoscriptType,
} from "./VALSK/valoscriptSteppers";
