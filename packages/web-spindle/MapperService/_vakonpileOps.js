// @flow

import { disjoinVPathOutline, cementVPath } from "~/raem/VPath";
// import { dumpObject } from "~/tools";

export function _vakonpileVPath (vpath, runtime) {
  const sections = disjoinVPathOutline(vpath, "@@");
  if ((sections[0] === "@$") && !sections[1]) return null;
  const stack = { context: contextRuleLookup, contextState: runtime, isPluralHead: false };
  const track = cementVPath(sections, stack);
  if (!stack.isPluralHead || ((track[track.length - 1] || [])[0] === "§map")) return track;
  if (sections[0] !== "@@") return ["§->", track, ["§map"]];
  track.push(["§map"]);
  return track;
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

const contextRuleLookup = {
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
