// @flow

import { ValoscriptNew } from "~/script";

import Discourse from "~/sourcerer";

export default {
  schemaTypeName: "Blob",
  symbols: {},
  typeFields: {
    [ValoscriptNew]: function new_ (
        discourse: Discourse, innerScope: ?Object, initialState: ?Object) {
      if (!initialState || !initialState.id) {
        throw new Error("initialState.id missing when trying to create a Bvob");
      }
      return discourse.getFollower().create("Blob", undefined, { discourse, id: initialState.id });
    },
  },
  prototypeFields: {},
};
