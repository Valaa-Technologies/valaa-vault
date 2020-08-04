// @flow

import { denoteDeprecatedValOSBuiltin, denoteValOSKueryFunction } from "~/raem/VALK";
import { qualifiedSymbol } from "~/raem/tools/namespaceSymbols";

import VALEK, { extractFunctionVAKON } from "~/engine/VALEK";

const symbols = {
  getTags: qualifiedSymbol("V", "getTags"),
};

export default {
  symbols,
  typeFields: {
    getNameOf: denoteDeprecatedValOSBuiltin("[valos.name]",
        `returns the host *name* of *this* resource`
    )(function getNameOf (discoverable) {
      return this.getFieldOf(discoverable, "name");
    }),
    setNameOf: denoteDeprecatedValOSBuiltin("[valos.name] = newName",
        `sets the host *name* of *this* resource to given *newName*`
    )(function setNameOf (discoverable, newName) {
      return this.setFieldOf(discoverable, "name", newName);
    }),
  },
  prototypeFields: {
    [symbols.getTags]: denoteValOSKueryFunction(
        `returns an array of host *tags* of *this* resource, ${
            ""}optionally filtered by given *additionalConditions*`
    )(function getTags (discoverable, ...additionalConditions) {
      return VALEK.tags(...additionalConditions.map(condition =>
          VALEK.fromVAKON(extractFunctionVAKON(condition)))
      ).toVAKON();
    }),
  }
};
