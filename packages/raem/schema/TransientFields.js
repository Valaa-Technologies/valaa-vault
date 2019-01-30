// @flow
import { GraphQLInterfaceType, GraphQLID, GraphQLNonNull, GraphQLList, GraphQLString }
    from "graphql/type";

import { getTransientTypeName } from "~/raem/state/Transient";

import aliasField from "~/raem/tools/graphql/aliasField";
import generatedField from "~/raem/tools/graphql/generatedField";
import primaryField from "~/raem/tools/graphql/primaryField";
import transientField from "~/raem/tools/graphql/transientField";
import ghostHostResolver from "~/raem/tools/graphql/ghostHostResolver";


import partitionResolver, { partitionURIResolver }
    from "~/raem/tools/graphql/partitionResolver";
import { typeNameResolver } from "~/raem/tools/graphql/typeResolver";

import { toOne, toMany, toOwner, toManyOwnlings, unspecifiedSingular, unspecifiedPlural }
    from "~/raem/tools/graphql/coupling";

import Partition from "~/raem/schema/Partition";

const INTERFACE_DESCRIPTION = "inactive resource fields";

const TransientFields = new GraphQLInterfaceType(transientFields());

export default TransientFields;

export function transientFields (objectDescription: string = INTERFACE_DESCRIPTION) {
  return {
    name: "TransientFields",

    description: `Fields available even for inactive Resource ${objectDescription}.`,

    fields: () => ({
      // TODO(iridian): Change the return type to GraphQLValaaReference (which must be defined).
      ...generatedField("id", new GraphQLNonNull(GraphQLID),
          `ValaaReference of this ${objectDescription}`,
          resource => resource.get("id"),
          { affiliatedType: "Transientfields" },
      ),

      ...generatedField("rawId", new GraphQLNonNull(GraphQLString),
          `Globally unique identifier of this ${objectDescription}`,
          resource => resource.get("id").rawId(),
          { affiliatedType: "Transientfields" },
      ),

      ...generatedField("typeName", new GraphQLNonNull(GraphQLString),
          `Type name of this ${objectDescription}`,
          getTransientTypeName,
          { affiliatedType: "Transientfields" },
      ),

      ...generatedField("partition", Partition,
          `The partition Resource of this ${objectDescription}, ie. the nearest owner (or self)${
              ""} which is also an active partition.`,
          partitionResolver,
          { affiliatedType: "Transientfields" },
      ),

      ...generatedField("partitionURI", GraphQLString,
          `The partitionURI string of the partition this ${objectDescription} belongs to.{
              ""} This root resource of this Partition is the innermost owning resource with {
              ""} Partition.partitionAuthorityURI set.`,
          partitionURIResolver,
          { affiliatedType: "Transientfields" },
      ),

      ...primaryField("prototype", TransientFields,
          `The prototype of this ${objectDescription}. All field lookups for which there is no${
            ""} associated value set and whose field descriptors don't have immediateDefaultValue${
            ""} are forwarded to the prototype.`, {
            coupling: toOne({ defaultCoupledField: "prototypers" }),
            affiliatedType: "TransientFields",
          },
      ),

      ...aliasField("prototypeAlias", "prototype", TransientFields,
          `The prototype of this ${objectDescription}. This is an alias for ${
              ""} TransientFields.prototype${
              ""} to bypass conflicts with native javascript property 'prototype'.`,
          { affiliatedType: "Transientfields" },
      ),

      ...generatedField("ownFields", TransientFields,
          `A transient version of this object without prototype. All property accesses will only${
            ""}return values owned directly.`,
          object => object.set("prototype", null),
          { affiliatedType: "Transientfields" },
      ),

      ...transientField("prototypers", new GraphQLList(TransientFields),
          `All ${objectDescription}'s which have this ${objectDescription
          } as prototype but which are not instances (direct nor ghost)`, {
            coupling: toMany({ coupledField: "prototype", preventsDestroy: true }),
            immediateDefaultValue: [],
            affiliatedType: "TransientFields",
          },
      ),

      ...aliasField("instancePrototype", "prototype", TransientFields,
          `Instance prototype of this ${objectDescription} instance`, {
            coupling: toOne({ coupledField: "instances" }),
            affiliatedType: "TransientFields",
          },
      ),

      ...transientField("instances", new GraphQLList(TransientFields),
          `Instances which have this ${objectDescription} as prototype`, {
            coupling: toMany({ coupledField: "prototype", preventsDestroy: true }),
            immediateDefaultValue: [],
            affiliatedType: "TransientFields",
          },
      ),

      ...aliasField("ghostPrototype", "prototype", TransientFields,
          `Ghost prototype for this ${objectDescription} ghost instance. The ghost prototype is${
            ""} the original resource from which this ghost was created during some instantiation.${
            ""} This instantiation (which happens on prototype and results in an instance of it)${
            ""} also ghost-instantiates all the direct and indirect ownlings of the prototype as${
            ""} ghosts in the instance. The instance is called the *ghost host* of all these${
            ""} ghosts. Likewise, the instance prototype is called the ghost host prototype,${
            ""} and the (grand-)ownlings of this ghost host prototype are the ghost prototypes of${
            ""} the corresponding ghosts (ie. this field).} `, {
          coupling: toOne({ coupledField: "materializedGhosts" }),
          affiliatedType: "TransientFields",
        },
      ),

      ...transientField("materializedGhosts", new GraphQLList(TransientFields),
          `Materialized ghosts which have this ${objectDescription} as their ghostPrototype`, {
            coupling: toMany({ coupledField: "prototype", preventsDestroy: true }),
            immediateDefaultValue: [],
            affiliatedType: "TransientFields",
          },
      ),

      ...transientField("unnamedCouplings", new GraphQLList(TransientFields),
          `Referrers without specified coupledField referring this ${objectDescription}`, {
            coupling: toMany({
              whenUnmatched: isPlural => (isPlural ? unspecifiedPlural() : unspecifiedSingular()),
            }),
            affiliatedType: "TransientFields",
          },
      ),


      ...generatedField("ghostHost", TransientFields,
          `The ghost host of this ghost ${objectDescription} or null if not a ghost. ${
            ""} The ghost host is the innermost direct or indirect non-ghost owner of this ghost, ${
            ""} or in other words the instance that indirectly created this ghost.`,
          ghostHostResolver, {
            affiliatedType: "TransientFields",
          },
      ),

      ...transientField("ghostOwner", TransientFields,
          `Refers to ghostHost if this ghost ${objectDescription} is materialized, otherwise null.${
            ""} Note that for materialized grand-ownling ghosts will have a different owner and${
            ""} ghostOwner and that destruction of either of them will result in immaterialization${
            ""} of the grand-ownling ghost.`, {
            coupling: toOwner({ coupledField: "ghostOwnlings" }),
            immediateDefaultValue: null,
            allowTransientFieldToBeSingular: true,
            affiliatedType: "TransientFields",
          },
      ),

      ...transientField("ghostOwnlings", new GraphQLList(TransientFields),
          `Materialized ghost Resource's which have this ${objectDescription
          } instance as their host`, {
            coupling: toManyOwnlings({ coupledField: "ghostOwner" }),
            immediateDefaultValue: [],
            affiliatedType: "TransientFields",
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