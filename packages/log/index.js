const { baseStateContext } = require("@valos/state");
const { visitVLogDelta } = require("./_visitVLogDelta");
const { applyVLogDeltaToState } = require("./_applyVLogDeltaToState");

module.exports = {
  baseLogContext: {
    ...baseStateContext,
    "&~": {
      "@base": "urn:valos:chronicle:0/",
      "@id": "VState:logicalResources", "@type": "@id", "@container": "@id",
    },
  },
  visitVLogDelta,
  applyVLogDeltaToState,
};
