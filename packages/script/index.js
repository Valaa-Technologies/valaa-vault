// @flow

import ContentAPI from "./ScriptContentAPI";
import * as mediaDecoders from "./mediaDecoders";

const valosheath = require("~/gateway-api/valosheath").default;

export default valosheath.exportSpindle({
  name: "@valos/script", ContentAPI, mediaDecoders,
  meta: { url: typeof __dirname !== "undefined" ?  __dirname : "" },
});


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
                                      descriptorExpression,
                                      valueExpression,
                                      extractFunctionVAKON,
                                      rootScopeSelf,
} from "./denormalized/expressions";
export {
                                      ValoscriptNew,
                                      ValoscriptInstantiate,
                                      ValoscriptPrimitiveKind,
                                      valoscriptInterfacePrototype,
                                      valoscriptPrimitivePrototype,
                                      valoscriptResourcePrototype,
                                      valoscriptTypePrototype,
} from "./VALSK/valoscriptSteppers";
