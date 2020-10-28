// @flow

import { disjoinVPlotOutline, cementVPlot } from "~/plot";
// import { dumpObject } from "~/tools";

export function _vakonpileVPlot (vplot, runtime, disjoinKey = "@@") {
  const sections = disjoinVPlotOutline(vplot, disjoinKey);
  if ((sections[0] === "@$") && !sections[1]) return null;
  const stack = { context: contextRuleLookup, contextState: runtime, isPluralHead: false };
  const track = cementVPlot(sections, stack);
  /*
  console.log("cemented vplot:", ...dumpObject(vplot),
      "\n\tvia sections:", ...dumpObject(sections),
      "\n\tinto track:", ...dumpObject(track),
      "\n\tplural head:", stack.isPluralHead);
  */
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
