// @flow
import { GraphQLObjectType, GraphQLString, GraphQLNonNull, GraphQLID, GraphQLList }
    from "graphql/type";

import generatedField from "~/raem/tools/graphql/generatedField";
import transientField from "~/raem/tools/graphql/transientField";
import { toMany } from "~/raem/tools/graphql/coupling";

import Resource from "~/raem/schema/Resource";

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
        { affiliatedType: "Blob" },
    ),

    ...generatedField("bvobId", new GraphQLNonNull(GraphQLString),
        `Globally unique identifier string of this Bvob`,
        bvob => bvob.get("id").rawId(),
        { affiliatedType: "Blob" },
    ),

    ...generatedField("contentHash", new GraphQLNonNull(GraphQLString),
        `The content hash of this Bvob`,
        bvob => bvob.get("id").rawId(),
        { affiliatedType: "Blob" },
    ),

    ...transientField("contentReferrers", new GraphQLList(Resource),
        `Incoming references to this Bvob`, {
          coupling: toMany({ defaultCoupledField: "content" }),
          affiliatedType: "Blob",
        }),
  }),
});
