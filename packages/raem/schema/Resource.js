// @flow
import { GraphQLInterfaceType, GraphQLList, GraphQLBoolean } from "graphql/type";

import generatedField from "~/raem/tools/graphql/generatedField";
import primaryField from "~/raem/tools/graphql/primaryField";
import transientField from "~/raem/tools/graphql/transientField";

import ghostHostResolver from "~/raem/tools/graphql/ghostHostResolver";
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

      ...generatedField("ghostHost", Resource,
          `The ghost host of this ghost ${objectDescription} or null if not a ghost. ${
            ""} The ghost host is the innermost direct or indirect non-ghost owner of this ghost, ${
            ""} or in other words the instance that indirectly created this ghost.`,
          ghostHostResolver,
      ),

      ...transientField("ghostOwner", Resource,
          `An alias for ghostHost but only set if this ghost ${objectDescription
          } is materialized, otherwise null. This means that for grand-ownling ghosts their ${
          ""} owner and ghostOwner will not be equal (for direct ownlings they are equal).`, {
            coupling: toOwner({ coupledField: "ghostOwnlings", affiliatedType: "Resource" }),
            immediateDefaultValue: null,
            allowTransientFieldToBeSingular: true,
          },
      ),

      ...transientField("ghostOwnlings", new GraphQLList(Resource),
          `Materialized ghost Resource's which have this ${objectDescription
          } instance as their host`, {
            coupling: toManyOwnlings({ coupledField: "ghostOwner", affiliatedType: "Resource" }),
            immediateDefaultValue: [],
          },
      ),
    }),

    resolveType: typeNameResolver,
  };
}
