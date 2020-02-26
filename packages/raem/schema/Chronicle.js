// @flow
import { GraphQLInterfaceType, GraphQLString } from "graphql/type";
import aliasField from "~/raem/tools/graphql/aliasField";
import primaryField from "~/raem/tools/graphql/primaryField";

import { typeNameResolver } from "~/raem/tools/graphql/typeResolver";

import TransientFields from "~/raem/schema/TransientFields";
import Resource, { resourceInterface } from "~/raem/schema/Resource";

const INTERFACE_DESCRIPTION = "chronicle";

export function chronicleInterface (objectDescription: string = INTERFACE_DESCRIPTION) {
  return {
    name: "Chronicle",

    description:
`A Chronicle is a partitioning of the whole ValOS object space into
smaller recursive wholes. The Chronicle implementation ${objectDescription}
contains Resource's either by direct or transitive ownership. Each such
contained Resource also knows their containing Chronicle.

In addition to the few direct member fields relating to snapshotting
and event stream synchronization, the Chronicle Resource's (here
${objectDescription}) serve as a key latching point for external
services.

Each Chronicle object is managed by a primary responsible content
service (or a paxos group of services), which does conflict resolution,
authorization and recording of incoming commands, converting them into
the event log for that particular Chronicle.

The Chronicle id is used by the query routers to globally locate the
service (group) responsible for any given Chronicle. Also,
cross-chronicle Resource references are implemented as Resource stubs,
ie. objects that only contain the Resource id and its most recently
known chronicle (which will retain the new owning Chronicle in a stub,
enabling forwarding). Together these allow for any Resource to always
be locateable from anywhere.`,

    interfaces: () => [Resource, TransientFields],

    fields: () => ({
      ...resourceInterface(objectDescription).fields(),

      ...primaryField("authorityURI", GraphQLString,
`The chronicle authority URI of this ${objectDescription}. If this field is set it ${
  ""} means that this is an active chronicle root object. The full chronicle URI is ${
  ""} generated as per the rules specified by the chronicle authority URI schema.`, {
            isDuplicateable: false,
            ownDefaultValue: null,
            affiliatedType: "Chronicle",
          },
      ),

      ...aliasField("partitionAuthorityURI", "authorityURI", GraphQLString,
`The chronicle authority URI of this ${objectDescription}. Deprecated
in favor of authorityURI.`, {
            isDuplicateable: false,
            ownDefaultValue: null,
            affiliatedType: "Chronicle",
          },
      ),
    }),
    resolveType: typeNameResolver,
  };
}

export default new GraphQLInterfaceType(chronicleInterface());
