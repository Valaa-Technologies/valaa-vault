// @flow
import { GraphQLInterfaceType, GraphQLList } from "graphql/type";

import { toMany, toManyOwnlings } from "~/raem/tools/graphql/coupling";
import { typeNameResolver } from "~/raem/tools/graphql/typeResolver";
import primaryField from "~/raem/tools/graphql/primaryField";
import transientField from "~/raem/tools/graphql/transientField";

import Discoverable from "~/raem/schema/Discoverable";
import Describable, { describableInterface } from "~/raem/schema/Describable";
import ResourceStub from "~/raem/schema/ResourceStub";
import Resource from "~/raem/schema/Resource";

import Relation from "~/script/schema/Relation";
import Scope, { scopeInterface } from "~/script/schema/Scope";

const INTERFACE_DESCRIPTION = "relatable";

export function relatableInterface (objectDescription: string = INTERFACE_DESCRIPTION) {
  return {
    name: "Relatable",

    description: "Interface for resources that can be set as Relation.source and Relation.target.",

    interfaces: () => [Scope, Describable, Discoverable, Resource, ResourceStub],

    resolveType: typeNameResolver,

    fields: () => ({
      ...describableInterface(objectDescription).fields(),
      ...scopeInterface(objectDescription).fields(),

      ...primaryField("relations", new GraphQLList(Relation),
          "List of relations that this relatable has",
          { coupling: toManyOwnlings() },
      ),

      ...transientField("incomingRelations", new GraphQLList(Relation),
          "List of relations that are targeting this relatable",
          { coupling: toMany({ coupledField: "target" }) },
      ),
    }),
  };
}

export default new GraphQLInterfaceType(relatableInterface());
