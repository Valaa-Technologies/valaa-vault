// @flow

import { ValoscriptNew } from "~/script";

import Discourse from "~/prophet";

export default {
  schemaTypeName: "Blob",
  symbols: {},
  typeFields: {
    [ValoscriptNew]: function new_ (
      discourse: Discourse, innerScope: ?Object, initialState: ?Object) {
      if (!initialState || !initialState.id) {
        throw new Error("initialState.id missing when trying to create a Bvob");
      }
      return discourse._follower.create("Blob", undefined, { discourse, id: initialState.id });
    },
  },
  prototypeFields: {},
};
