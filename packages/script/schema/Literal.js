// @flow
import { GraphQLObjectType, GraphQLNonNull, GraphQLString } from "graphql/type";

import VALK from "~/raem/VALK";
import generatedField from "~/raem/tools/graphql/generatedField";
import primaryField from "~/raem/tools/graphql/primaryField";
import dataFieldValue from "~/raem/tools/denormalized/dataFieldValue";

import Data from "~/raem/schema/Data";

import LiteralValue from "~/raem/schema/LiteralValue";
import Tag from "~/raem/schema/Tag";

import Expression, { expressionInterface } from "./Expression";

const OBJECT_DESCRIPTION = "literal";

// FIXME(iridian): Add proper support for JS types, now output is always strings.
export default new GraphQLObjectType({
  name: "Literal",

  description: "A JSON literal of type String, Number, Boolean or null",

  interfaces: () => [Expression, Tag, Data],

  fields: () => ({
    ...expressionInterface(OBJECT_DESCRIPTION).fields(),

    ...primaryField("value", LiteralValue,
        "The literal value as JS native representation",
    ),

    ...generatedField("asVAKON", LiteralValue,
        `The Literal value as asVAKON literal`,
        source => {
          if (!source.hasOwnProperty("_VAKON")) {
            const value = dataFieldValue(source, "value");
            source._VAKON = (typeof value === "undefined")
                ? VALK.void()
                : VALK.fromValue(value).toJSON();
          }
          return source._VAKON;
        },
    ),

    ...generatedField("expressionText", new GraphQLNonNull(GraphQLString),
        "Text representation of the literal value as per ECMA-262 JSON.stringify",
        source => JSON.stringify(dataFieldValue(source, "value")),
    ),

    ...generatedField("tagURI", new GraphQLNonNull(GraphQLString),
        `Literal tag URI format is tag://valaa.com,2017:Literal/uriString where the uriString {
            ""} is encodeURIComponent(JSON.stringify(value)), with value as JSON`,
        source => `tag://valaa.com,2017:Literal/${
            encodeURIComponent(JSON.stringify(dataFieldValue(source, "value")))}`,
    ),

    ...generatedField("literal", new GraphQLNonNull(GraphQLString),
        "Deprecated field",
        () => undefined,
        { deprecated: { prefer: "asVAKON or value" } },
    ),
  }),
});
