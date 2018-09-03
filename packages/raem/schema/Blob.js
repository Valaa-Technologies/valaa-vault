// @flow
import { GraphQLObjectType, GraphQLString, GraphQLNonNull, GraphQLID, GraphQLList }
    from "graphql/type";

import generatedField from "~/raem/tools/graphql/generatedField";
import transientField from "~/raem/tools/graphql/transientField";
import { toMany } from "~/raem/tools/graphql/coupling";

export default new GraphQLObjectType({
  name: "Blob",

  fields: () => ({
    ...generatedField("id", new GraphQLNonNull(GraphQLID),
        `Content-hashed identifier of the Bvob`,
        bvob => bvob.get("id")
    ),

    ...generatedField("blobId", new GraphQLNonNull(GraphQLString),
        `Globally unique identifier string of this Bvob`,
        bvob => bvob.get("id").rawId(),
    ),

    ...generatedField("bvobId", new GraphQLNonNull(GraphQLString),
        `Globally unique identifier string of this Bvob`,
        bvob => bvob.get("id").rawId(),
    ),

    ...transientField("contentReferrers", new GraphQLList(GraphQLID),
        `Incoming references to this Bvob`,
        { coupling: toMany({ defaultCoupledField: "content" }) }),
  }),
});
