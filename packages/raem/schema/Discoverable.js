// @flow
import { GraphQLInterfaceType, GraphQLString, GraphQLList } from "graphql/type";

import primaryField from "~/raem/tools/graphql/primaryField";
import aliasField from "~/raem/tools/graphql/aliasField";
import { typeNameResolver } from "~/raem/tools/graphql/typeResolver";

import TransientFields from "~/raem/schema/TransientFields";
import Resource, { resourceInterface } from "~/raem/schema/Resource";

import Tag from "~/raem/schema/Tag";

const INTERFACE_DESCRIPTION = "discoverable";

export function discoverableInterface (objectDescription: string = INTERFACE_DESCRIPTION) {
  return {
    name: "Discoverable",

    description: "An object that can be searched using various means",

    interfaces: () => [Resource, TransientFields],

    fields: () => ({
      ...resourceInterface(objectDescription).fields(),

      ...primaryField("name", GraphQLString,
          `Primary searchable name of this ${objectDescription}. It is globally non-unique, {
              ""}but possibly context-dependently unique`),

      ...aliasField("nameAlias", "name", GraphQLString,
          `Primary searchable name of this ${objectDescription}. It is globally non-unique, {
              ""}but possibly context-dependently unique. This is an alias for Discoverable.name ${
              ""}to bypass conflicts with native javascript property 'name'.`,
      ),

      ...primaryField("tags", new GraphQLList(Tag),
          `Tags of this ${objectDescription}`),
    }),

    resolveType: typeNameResolver,
  };
}

export default new GraphQLInterfaceType(discoverableInterface());
