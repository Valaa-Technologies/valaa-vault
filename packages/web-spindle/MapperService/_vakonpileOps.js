// @flow

import { segmentVPath, cementVPath } from "~/raem/VPath";

export function _vakonpileVPath (vpath, runtime) {
  const segmentedVPath = segmentVPath(vpath);
  if ((segmentedVPath.length === 1) && (segmentedVPath[0] === "@")) return null;
  const stack = { context: ruleContextLookup, contextState: runtime, isPluralHead: false };
  const ret = cementVPath(segmentedVPath, stack);
  if (!stack.isPluralHead || ((ret[ret.length - 1] || [])[0] === "§map")) return ret;
  if (segmentedVPath[0] !== "@") return ["§->", ret, ["§map"]];
  ret.push(["§map"]);
  return ret;
}

const valk = {
  stepsFor: {
    invoke: ["§invoke"],
    ref: ["§ref"],
    new: ["§new"],
    const: ["§$<-"],
    nullable: false,
  },
};

const valos = {
  steps: ["§."],
};

const ruleContextLookup = {
  valk,
  valos,
  V: valos,
  "~chr": reference,
  "~ch3": reference,
  "~cih": reference,
  "~raw": reference,
  "~u4": reference,
};

function reference (runtime, param, contextTerm) {
  if (typeof param !== "string") {
    throw new Error(`Expected string VGRID '${contextTerm}' param value, got ${
        param === null ? "null" : typeof param}`);
  }
  runtime.staticResources.push([param]);
  return ["§ref", ["§[]", param]];
}
