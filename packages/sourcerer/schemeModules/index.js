// @flow

import createValaaLocal from "./valaa-local";
import createValaaMemory from "./valaa-memory";
import createValaaTransient from "./valaa-transient";

export default {
  "valaa-local": createValaaLocal,
  "valaa-memory": createValaaMemory,
  "valaa-transient": createValaaTransient,
};
