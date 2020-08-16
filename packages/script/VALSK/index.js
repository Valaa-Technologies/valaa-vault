// @flow

import { Kuery } from "~/raem/VALK";
import ValoscriptKuery, { ScopeAccessesTag, ScopeAccessKeysTag } from "./ValoscriptKuery";

export default new ValoscriptKuery();

export {
  Valker,
  run,
  dumpScope,
  dumpKuery,
  dumpObject,
  isValOSFunction,
  toVAKONTag,
} from "~/raem/VALK";

export {
  Kuery,
  ScopeAccessesTag,
  ScopeAccessKeysTag,
  ValoscriptKuery,
};
export {
  default as valoscriptSteppers,
} from "./valoscriptSteppers";
