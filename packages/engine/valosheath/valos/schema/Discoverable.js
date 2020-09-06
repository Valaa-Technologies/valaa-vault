// @flow
/*
import { denoteDeprecatedValOSCallable, denoteValOSKueryFunction } from "~/raem/VALK";
import { qualifiedSymbol } from "~/raem/tools/namespaceSymbols";
import { extractFunctionVAKON } from "~/script";
import VALEK from "~/engine/VALEK";
*/
const symbols = {
  // getTags: qualifiedSymbol("V", "getTags"),
};

export default {
  symbols,
  typeFields: {
    /*
    getNameOf: denoteDeprecatedValOSCallable(
        `returns the host *name* of *this* resource`,
        ["DEPRECATED", "[valos.name]"],
    )(function getNameOf (discoverable) {
      return this.getFieldOf(discoverable, "name");
    }),
    setNameOf: denoteDeprecatedValOSCallable(,
        `sets the host *name* of *this* resource to given *newName*`,
        ["DEPRECATED", "[valos.name] = newName"],
    )(function setNameOf (discoverable, newName) {
      return this.setFieldOf(discoverable, "name", newName);
    }),
    */
  },
  prototypeFields: {
    /*
    [symbols.getTags]: denoteValOSKueryFunction(
`Returns an array of host *tags* of *this* resource, optionally
filtered by given *additionalConditions*`,
    )(function getTags (discoverable, ...additionalConditions) {
      return VALEK.tags(...additionalConditions.map(condition =>
          VALEK.fromVAKON(extractFunctionVAKON(condition)))
      ).toVAKON();
    }),
    */
  }
};
