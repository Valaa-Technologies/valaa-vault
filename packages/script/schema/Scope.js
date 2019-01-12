// @flow
import { GraphQLList, GraphQLInterfaceType } from "graphql/type";

import primaryField from "~/raem/tools/graphql/primaryField";
import { toManyOwnlings } from "~/raem/tools/graphql/coupling";
import { typeNameResolver } from "~/raem/tools/graphql/typeResolver";
import TransientFields, { transientFields } from "~/raem/schema/TransientFields";

import Property from "./Property";

const INTERFACE_DESCRIPTION = "scope";

// Note: scopeInterface doesn't introduce either resource or data fields. They must be explicitly
// introduced.
export function scopeInterface (objectDescription: string = INTERFACE_DESCRIPTION) {
  return {
    name: "Scope",

    description: "A scope of variables by name",

    interfaces: () => [TransientFields],

    fields: () => ({
      ...transientFields(objectDescription).fields(),
      ...primaryField("properties", new GraphQLList(Property),
          `Properties of ${objectDescription} as a list of key-value pairs`,
          { coupling: toManyOwnlings({}), affiliatedType: "Scope" },
      ),
    }),

    resolveType: typeNameResolver,
  };
}

export default new GraphQLInterfaceType(scopeInterface());
