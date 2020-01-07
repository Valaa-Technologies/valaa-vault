// @flow
import { GraphQLObjectType, GraphQLNonNull, GraphQLString, GraphQLList }
    from "graphql/type";
import primaryField from "~/raem/tools/graphql/primaryField";
import generatedField from "~/raem/tools/graphql/generatedField";
import dataFieldValue from "~/raem/tools/denormalized/dataFieldValue";

import Data, { dataInterface } from "~/raem/schema/Data";

const OBJECT_DESCRIPTION = "media type";

export default new GraphQLObjectType({
  name: "MediaType",

  description: `MIME type in expanded format. See https://tools.ietf.org/html/rfc2045 and
https://tools.ietf.org/html/rfc6838`,

  interfaces: () => [Data],

  fields: () => ({
    ...dataInterface(OBJECT_DESCRIPTION).fields(),

    ...generatedField("text", new GraphQLNonNull(GraphQLString),
        "Text representation of the media type.",
        contentTypeFromMediaType
    ),

    ...generatedField("contentType", new GraphQLNonNull(GraphQLString),
        "Text representation of the media type.",
        contentTypeFromMediaType
    ),

    ...primaryField("type", new GraphQLNonNull(GraphQLString),
        "type string, case insensitive."
    ),

    ...primaryField("subtype", new GraphQLNonNull(GraphQLString),
        "subtype string, case insensitive.",
    ),

    ...primaryField("parameters", new GraphQLList(GraphQLString),
      `parameters of the media type, as a sequence of "attribute = value" strings.
Token matching is case insensitive.`,
    ),
  }),
  // typeofEqualTo (value) { return value.kind === POSITION; },
});

function contentTypeFromMediaType (source) {
  const params = dataFieldValue(source, "parameters");
  return `${dataFieldValue(source, "type")}/${dataFieldValue(source, "subtype")}${
    !params ? "" :
    Array.isArray(params) ? params.reduce((left, right) => left + right)
      : JSON.stringify(params)}`;
}
