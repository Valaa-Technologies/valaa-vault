// @flow
import { GraphQLObjectType } from "graphql/type";

import TransientFields, { transientFields } from "~/raem/schema/TransientFields";

const OBJECT_DESCRIPTION = "destroyed resource";

export default new GraphQLObjectType({
  name: "DestroyedResource",

  description: `A DestroyedResource is a Resource which has been${
      ""}destroyed and only provides the external fields listed in${
      ""}TransientFields interface.`,

  interfaces: () => [TransientFields],

  fields: () => ({
    ...transientFields(OBJECT_DESCRIPTION).fields(),
  }),
});
