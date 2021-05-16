const { baseStateContext } = require("@valos/state");
const { visitVLogDelta } = require("./_visitVLogDelta");
const { applyVLogDeltaToState } = require("./_applyVLogDeltaToState");

module.exports = {
  baseLogContext: [
    ...baseStateContext, {
      "!~": { "@id": "VLog:logicalOwner", "@type": "@id" },
      "!--": { "@id": "VLog:removalSubGraph", "@container": "@graph" },
      "!/": { "@id": "VLog:indirectSubGraph", "@container": ["@graph", "@index"] },
    },
  ],
  visitVLogDelta,
  applyVLogDeltaToState,
};
