// @flow

import { expandVKeyPath, cementVPath } from "~/raem/VPath";

export function _vakonpileVPath (vpath, runtime) {
  const expandedVPath = expandVKeyPath("@", vpath);
  if ((expandedVPath.length === 1) && (expandedVPath[0] === "@")) return null;
  const ret = cementVPath(expandedVPath, { context: ruleContextLookup, contextState: runtime });
  const lastVerb = (expandedVPath[0] === "@")
      ? expandedVPath[expandedVPath.length - 1]
      : expandedVPath;
  if ((lastVerb[0] || "")[0] === "*") {
    if (expandedVPath[0] !== "@") {
      return ["§->", ret, ["§map"]];
    }
    ret.push(["§map"]);
  }
  return ret;
}

const valk = {
  stepsFor: {
    invoke: ["§invoke"],
    ref: ["§ref"],
    new: ["§new"],
  },
};

const valos = {
  steps: ["§."],
};

const ruleContextLookup = {
  valk,
  valos,
  V: valos,
  "~u4": reference,
  "~gh": reference,
};

function reference (runtime, param, contextTerm) {
  if (typeof param !== "string") {
    throw new Error(`Expected string vgrid '${contextTerm}' param value, got ${
        param === null ? "null" : typeof param}`);
  }
  runtime.staticResources.push([param]);
  return ["§ref", ["§[]", param]];
}
