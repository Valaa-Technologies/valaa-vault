// @flow
import { GraphQLObjectType } from "graphql/type";

import TransientFields, { transientFields } from "~/raem/schema/TransientFields";
import TransientScriptFields, { transientScriptFields }
    from "~/script/schema/TransientScriptFields";

const OBJECT_DESCRIPTION = "inactive script resource";

export default new GraphQLObjectType({
  name: "InactiveScriptResource",

  description: `An InactiveScriptResource is a @valos/prophet ${
      ""}resource whose partition has not yet been fully loaded. It ${
      ""}has only the limited set of fields of TransientFields and ${
      ""}TransientScriptFields available. The transition from ${
      ""}InactiveScriptResource to and from other concrete Resource ${
      ""}types is the only possible runtime type change. This ${
      ""}happens dynamically based on the partition activation and ${
      ""}inactivation.`,

  interfaces: () => [TransientScriptFields, TransientFields],

  fields: () => ({
    ...transientFields(OBJECT_DESCRIPTION).fields(),
    ...transientScriptFields(OBJECT_DESCRIPTION).fields(),
  }),
});
