const { baseStateContext } = require("@valos/state");
const { visitVLogDelta } = require("./_visitVLogDelta");
const { applyVLogDeltaToState } = require("./_applyVLogDeltaToState");

module.exports = {
  baseLogContext: [
    ...baseStateContext, {
    },
  ],
  visitVLogDelta,
  applyVLogDeltaToState,
};
