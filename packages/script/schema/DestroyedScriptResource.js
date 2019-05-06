// @flow
import { GraphQLObjectType } from "graphql/type";

import TransientFields, { transientFields } from "~/raem/schema/TransientFields";
import TransientScriptFields, { transientScriptFields }
    from "~/script/schema/TransientScriptFields";

const OBJECT_DESCRIPTION = "inactive script resource";

export default new GraphQLObjectType({
  name: "DestroyedScriptResource",

  description: `An DestroyedScriptResource is a @valos/sourcerer${
    ""}Resource that has been destroyed and only provides the${
    ""}external fields listed in TransientScripFields and${
    ""}TransientFields interfaces.`,

  interfaces: () => [TransientScriptFields, TransientFields],

  fields: () => ({
    ...transientFields(OBJECT_DESCRIPTION).fields(),
    ...transientScriptFields(OBJECT_DESCRIPTION).fields(),
  }),
});
