// @flow
import { GraphQLInterfaceType, GraphQLList } from "graphql/type";

import { toManyOwnlings } from "~/raem/tools/graphql/coupling";
import { typeNameResolver } from "~/raem/tools/graphql/typeResolver";
import aliasField from "~/raem/tools/graphql/aliasField";
import primaryField from "~/raem/tools/graphql/primaryField";

import Discoverable from "~/raem/schema/Discoverable";
import Describable, { describableInterface } from "~/raem/schema/Describable";
import TransientFields from "~/raem/schema/TransientFields";
import Resource from "~/raem/schema/Resource";

import Relation from "~/script/schema/Relation";
import Scope, { scopeInterface } from "~/script/schema/Scope";
import TransientScriptFields, { transientScriptFields }
    from "~/script/schema/TransientScriptFields";

const INTERFACE_DESCRIPTION = "relatable";

export function relatableInterface (objectDescription: string = INTERFACE_DESCRIPTION) {
  return {
    name: "Relatable",

    description: "Interface for resources that can be set as Relation.source and Relation.target.",

    interfaces: () => [
      Scope, TransientScriptFields,
      Describable, Discoverable, Resource, TransientFields,
    ],

    resolveType: typeNameResolver,

    fields: () => ({
      ...describableInterface(objectDescription).fields(),
      ...scopeInterface(objectDescription).fields(),
      ...transientScriptFields(objectDescription).fields(),

      ...primaryField("relations", new GraphQLList(Relation),
          "List of relations that this relatable has",
          { coupling: toManyOwnlings({}), affiliatedType: "Relatable" },
      ),

      ...aliasField("entities", "unnamedOwnlings", new GraphQLList(Resource),
          `List of entities that this relatable has`,
          { filterTypeName: "Entity", affiliatedType: "Relatable" },
      ),

      ...aliasField("medias", "unnamedOwnlings", new GraphQLList(Resource),
          `List of medias that this relatable has`,
          { filterTypeName: "Media", affiliatedType: "Relatable" },
      ),
    }),
  };
}

export default new GraphQLInterfaceType(relatableInterface());
