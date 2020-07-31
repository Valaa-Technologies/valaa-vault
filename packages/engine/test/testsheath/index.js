// @flow

import extendValos from "~/engine/test/testsheath/valos";
import type { Discourse } from "~/sourcerer/api/types";

export default function extendTestsheath (
    globalScope: Object, hostDescriptors: Map<any, Object>, rootDiscourse: Discourse) {
  extendValos(globalScope, hostDescriptors, rootDiscourse);
  return globalScope.valos;
}
