// @flow

import getImplicitMediaInterpretation from "~/engine/Vrapper/getImplicitMediaInterpretation";

export default function getImplicitCallable (calleeCandidate: any, roleName: string,
    options: Object = {}) {
  options.mime = "application/valoscript";
  const ret = getImplicitMediaInterpretation(calleeCandidate, roleName, options);
  if (typeof ret === "function") return ret;
  if ((typeof ret === "object") && (typeof ret.default === "function")) return ret.default;
  throw new Error(`Can't convert ${typeof ret} callee to a function for ${roleName}`);
}
