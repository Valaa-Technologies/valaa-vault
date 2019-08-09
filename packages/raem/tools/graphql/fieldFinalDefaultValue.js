import { GraphQLList, GraphQLScalarType } from "graphql/type";
import { OrderedMap } from "immutable";

/**
 *  Returns the default values for fields which are undefined in the store.
 *
 * @export
 * @param {any} field
 * @returns
 */
export default function fieldFinalDefaultValue (fieldIntro) {
  const type = fieldIntro.type;
  return type instanceof GraphQLList ? OrderedMap()
      : type instanceof GraphQLScalarType ?
          (type.name === "String" ? ""
          : type.name === "Int" ? 0
          : type.name === "Float" ? 0.0
          : type.name === "Boolean" ? false
          : null)
  // TODO(iridian): Deal with enum's and unions
  // enums, choose first? field.getValues()[0].value
      : null;
}
