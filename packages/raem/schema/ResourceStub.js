// @flow
import { GraphQLInterfaceType, GraphQLID, GraphQLNonNull, GraphQLList, GraphQLString }
    from "graphql/type";

import { getTransientTypeName } from "~/raem/state/Transient";

import aliasField from "~/raem/tools/graphql/aliasField";
import generatedField from "~/raem/tools/graphql/generatedField";
import primaryField from "~/raem/tools/graphql/primaryField";
import transientField from "~/raem/tools/graphql/transientField";

import partitionResolver, { partitionURIResolver }
    from "~/raem/tools/graphql/partitionResolver";
import { typeNameResolver } from "~/raem/tools/graphql/typeResolver";

import { toOne, toMany, unspecifiedSingular, unspecifiedPlural }
    from "~/raem/tools/graphql/coupling";

import Partition from "~/raem/schema/Partition";

const INTERFACE_DESCRIPTION = "inactive resource";

const ResourceStub = new GraphQLInterfaceType(resourceStub());

export default ResourceStub;

export function resourceStub (objectDescription: string = INTERFACE_DESCRIPTION) {
  return {
    name: "ResourceStub",

    description: `Fields available even for inactive Resource ${objectDescription}.`,

    fields: () => ({
      // TODO(iridian): Change the return type to GraphQLValaaReference (which must be defined).
      ...generatedField("id", new GraphQLNonNull(GraphQLID),
          `ValaaReference of this ${objectDescription}`,
          resource => resource.get("id"),
      ),

      ...generatedField("rawId", new GraphQLNonNull(GraphQLString),
          `Globally unique identifier of this ${objectDescription}`,
          resource => resource.get("id").rawId(),
      ),

      ...generatedField("typeName", new GraphQLNonNull(GraphQLString),
          `Type name of this ${objectDescription}`,
          getTransientTypeName,
      ),

      ...generatedField("partition", Partition,
          `The partition Resource of this ${objectDescription}, ie. the nearest owner (or self)${
              ""} which is also an active partition.`,
          partitionResolver,
      ),

      ...generatedField("partitionURI", GraphQLString,
          `The partitionURI string of the partition this ${objectDescription} belongs to.{
              ""} This root resource of this Partition is the innermost owning resource with {
              ""} Partition.partitionAuthorityURI set.`,
          partitionURIResolver,
      ),

      ...primaryField("prototype", ResourceStub,
          `The prototype of this ${objectDescription}. All field lookups for which there is no${
            ""} associated value set and whose field descriptors don't have immediateDefaultValue${
            ""} are forwarded to the prototype.`,
          { coupling: toOne({ defaultCoupledField: "prototypers" }) },
      ),

      ...aliasField("prototypeAlias", "prototype", ResourceStub,
          `The prototype of this ${objectDescription}. This is an alias for ResourceStub.prototype${
              ""} to bypass conflicts with native javascript property 'prototype'.`,
      ),

      ...generatedField("ownFields", ResourceStub,
          `A transient version of this object without prototype. All property accesses will only${
            ""}return values owned directly.`,
          object => object.set("prototype", null),
      ),

      ...transientField("prototypers", new GraphQLList(ResourceStub),
          `All ${objectDescription}'s which have this ${objectDescription
          } as prototype but which are not instances (direct nor ghost)`, {
            coupling: toMany({ coupledField: "prototype", preventsDestroy: true }),
            immediateDefaultValue: [],
          },
      ),

      ...aliasField("instancePrototype", "prototype", ResourceStub,
          `Instance prototype of this ${objectDescription} instance`,
          { coupling: toOne({ coupledField: "instances" }) },
      ),

      ...transientField("instances", new GraphQLList(ResourceStub),
          `Instances which have this ${objectDescription} as prototype`, {
            coupling: toMany({ coupledField: "prototype", preventsDestroy: true, }),
            immediateDefaultValue: [],
          },
      ),

      ...aliasField("ghostPrototype", "prototype", ResourceStub,
          `Ghost prototype for this ${objectDescription} ghost instance. The ghost prototype is${
            ""} the original resource from which this ghost was created during some instantiation.${
            ""} This instantiation (which happens on prototype and results in an instance of it)${
            ""} also ghost-instantiates all the direct and indirect ownlings of the prototype as${
            ""} ghosts in the instance. The instance is called the *ghost host* of all these${
            ""} ghosts. Likewise, the instance prototype is called the ghost host prototype,${
            ""} and the (grand-)ownlings of this ghost host prototype are the ghost prototypes of${
            ""} the corresponding ghosts (ie. this field).} `,
          { coupling: toOne({ coupledField: "materializedGhosts" }) },
      ),

      ...transientField("materializedGhosts", new GraphQLList(ResourceStub),
          `Materialized ghosts which have this ${objectDescription} as their ghostPrototype`, {
            coupling: toMany({ coupledField: "prototype", preventsDestroy: true }),
            immediateDefaultValue: [],
          },
      ),

      ...transientField("unnamedCouplings", new GraphQLList(ResourceStub),
          `Referrers without specified coupledField referring this ${objectDescription}`, {
            coupling: toMany({
              whenUnmatched: isPlural => (isPlural ? unspecifiedPlural() : unspecifiedSingular()),
            })
          },
      ),

      /* TODO(iridian): Design and implement data couplings concept for tracking incoming Identifier
       * and other references. Note that the Data objects by nature can currently exist in
       * nested expanded form in the store without id so this is not trivial.
       *
       * See Data.js for more.
       *
      ...shadowField("referredDatas", new GraphQLList(Data),
          `TODO(iridian): Write description`, {
            shadow: true,
            coupling: toMany({ coupledField: "referringDatas" }),
          }
      ),
      ...shadowField("referringDatas", new GraphQLList(Data),
          `TODO(iridian): Write description`
          { coupling: toMany({ coupledField: "referredDatas" }) },
      }),
      */
    }),

    resolveType: typeNameResolver,
  };
}
