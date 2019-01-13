// @flow
import { GraphQLInterfaceType, GraphQLList, GraphQLBoolean } from "graphql/type";

import primaryField from "~/raem/tools/graphql/primaryField";
import { typeNameResolver } from "~/raem/tools/graphql/typeResolver";

import { toOwner, toManyOwnlings } from "~/raem/tools/graphql/coupling";

import TransientFields, { transientFields } from "~/raem/schema/TransientFields";

const INTERFACE_DESCRIPTION = "resource";

const Resource = new GraphQLInterfaceType(resourceInterface());

export default Resource;

export function resourceInterface (objectDescription: string = INTERFACE_DESCRIPTION) {
  return {
    name: "Resource",

    description: `A first-class object that can be directly created and mutated through GraphQL
queries through by its id. It has identity and thus can also be destroyed. In these
instances to maintain referential integrity all references will be nulled and all Resource's/Data's
containing non-nullable references will be cascade destroyed.`,

    interfaces: () => [TransientFields],

    fields: () => ({
      ...transientFields(objectDescription).fields(),

      ...primaryField("owner", Resource,
          `Owner of the resource`,
          { coupling: toOwner({}), affiliatedType: "Resource" },
      ),

      ...primaryField("unnamedOwnlings", new GraphQLList(Resource),
          `Ownling Resource's of this ${objectDescription
              } which are not part of another named owning property`,
          { coupling: toManyOwnlings({}), affiliatedType: "Resource" },
      ),

      ...primaryField("isFrozen", GraphQLBoolean,
          `Indicates whether this ${objectDescription} is frozen. A frozen Resource nor any of its${
          ""} ownlings cannot have any of their primary fields be modified. Setting isFrozen to${
          ""} true is (by design) an irreversible operation. If this ${objectDescription} is also${
          ""} the root resource of a partition the whole partition is permanently frozen.`, {
            isDuplicateable: false,
            immediateDefaultValue: false,
          },
      ),
    }),

    resolveType: typeNameResolver,
  };
}
