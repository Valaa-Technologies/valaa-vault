// @flow
import { GraphQLInterfaceType, GraphQLList } from "graphql/type";
import primaryField from "~/raem/tools/graphql/primaryField";
import { typeNameResolver } from "~/raem/tools/graphql/typeResolver";
import { toManyOwnlings } from "~/raem/tools/graphql/coupling";

import Description from "~/raem/schema/Description";
import Discoverable, { discoverableInterface } from "~/raem/schema/Discoverable";
import TransientFields from "~/raem/schema/TransientFields";
import Resource from "~/raem/schema/Resource";

const INTERFACE_DESCRIPTION = "describable";

export function describableInterface (objectDescription: string = INTERFACE_DESCRIPTION) {
  return {
    name: "Describable",

    description: "An object that can be searched using various means",

    interfaces: () => [Discoverable, Resource, TransientFields],

    fields: () => ({
      ...discoverableInterface(objectDescription).fields(),

      ...primaryField("description", new GraphQLList(Description),
          `The description of this ${objectDescription}`,
          { coupling: toManyOwnlings() },
      ),
    }),

    resolveType: typeNameResolver,
  };
}

export default new GraphQLInterfaceType(describableInterface());
