// @flow

import {
  denoteValOSCallable,
} from "~/raem/VALK";
import { qualifiedSymbol } from "~/tools/namespace";

const symbols = {
  getFickleId: qualifiedSymbol("V", "getFickleId"),
};

export default {
  schemaTypeName: "TransientFields",
  namespaceAccessors: {
    V: "valos",
  },
  symbols,
  typeFields: {},
  prototypeFields: {
    [symbols.getFickleId]: denoteValOSCallable([
`Returns a short, descriptive but fickle identifier string of this
resource.`,
`The fickle is uniquely mapped to this resource but during this
execution session only. The returned fickle id string is guaranteed to
be at least the given *minimumLength* characters long. The fickle id
may be longer if a shorter id candidate is already allocated for
another resource.

The fickle algorithm is a best-effort algorithm which /most of the time/
returns a prefix of the resource raw id that is same across sessions,
but none of these qualities is guaranteed.
`,
      ])(function getFickleId (minimumLength) {
        return Vrapper.prototype.getFickleId.call(this, minimumLength);
      }),
  },
};
