// @flow
import { GraphQLInterfaceType, GraphQLString, GraphQLList } from "graphql/type";

import generatedField from "~/raem/tools/graphql/generatedField";
import primaryField from "~/raem/tools/graphql/primaryField";
import aliasField from "~/raem/tools/graphql/aliasField";
import { typeNameResolver } from "~/raem/tools/graphql/typeResolver";

import getObjectField from "~/raem/state/getObjectField";

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
          `The fully qualified name of this ${objectDescription}. It is globally non-unique, {
              ""}but possibly context-dependently unique`),

      ...generatedField("prefix", GraphQLString,
          `The namespace prefix of the qualified name.`,
          function prefixResolver (source: any, args: any,
              { rootValue: { resolver } }: Object) {
            const name = getObjectField(Object.create(resolver), source, "name");
            if (!name.startsWith("@$") || !name.endsWith("@@")) return undefined;
            return name.slice(2, name.indexOf("."));
          },
          { affiliatedType: "Discoverable" },
      ),

      ...generatedField("localPart", GraphQLString,
          `The local part of the qualified name.`,
          function localPartResolver (source: any, args: any,
            { rootValue: { resolver } }: Object) {
          const name = getObjectField(Object.create(resolver), source, "name");
          if (!name.startsWith("@$") || !name.endsWith("@@")) return name;
          return decodeURIComponent(name.slice(name.indexOf(".") + 1, -2));
        },
        { affiliatedType: "Discoverable" },
      ),

      ...aliasField("nameAlias", "name", GraphQLString,
          `Primary searchable name of this ${objectDescription}. It is globally non-unique, {
              ""}but possibly context-dependently unique. This is an alias for Discoverable.name ${
              ""}to bypass conflicts with native javascript property 'name'.`,
          { affiliatedType: "Discoverable" },
      ),

      ...primaryField("tags", new GraphQLList(Tag),
          `Tags of this ${objectDescription}`),
    }),

    resolveType: typeNameResolver,
  };
}

export default new GraphQLInterfaceType(discoverableInterface());
