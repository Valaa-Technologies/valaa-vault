// @flow
import { GraphQLID, GraphQLNonNull, GraphQLInterfaceType, GraphQLString } from "graphql/type";
import primaryField from "~/raem/tools/graphql/primaryField";
import generatedField from "~/raem/tools/graphql/generatedField";
import { partitionHeadEventIdResolver, partitionSnapshotResolver,
    partitionDeepSnapshotResolver } from "~/raem/tools/graphql/partitionResolver";

import { typeNameResolver } from "~/raem/tools/graphql/typeResolver";

import ResourceStub from "~/raem/schema/ResourceStub";
import Resource, { resourceInterface } from "~/raem/schema/Resource";

const INTERFACE_DESCRIPTION = "partition";

export function partitionInterface (objectDescription: string = INTERFACE_DESCRIPTION) {
  return {
    name: "Partition",

    description: `A Partition is a subdivision of the whole Valaa object space into smaller
recursive wholes. The Partition implementation ${objectDescription} contains Resource's either by
direct or transitive ownership. Each such contained Resource also knows their containing Partition.

In addition to the few direct member fields relating to snapshotting and event stream
synchronization, the Partition Resource's (here ${objectDescription}) serve as a key latching
point for external services.

Each Partition object is managed by a primary responsible content service (or a paxos group of
services), which does conflict resolution, authorization and recording of incoming commands,
converting them into the event log for that particular Partition.

The Partition id is used by the query routers to globally locate the service (group) responsible for
any given Partition. Also, cross-partition Resource references are implemented as Resource stubs,
ie. objects that only contain the Resource id and its most recently known partition (which will
retain the new owning Partition in a stub, enabling forwarding). Together these allow for any
Resource to always be locateable from anywhere.`,

    interfaces: () => [Resource, ResourceStub],

    fields: () => ({
      ...resourceInterface(objectDescription).fields(),

      ...primaryField("partitionAuthorityURI", GraphQLString,
          `The partition authority URI of this ${objectDescription}. If this field is set it ${
          ""} means that this is an active partition root object. The full partition URI is ${
          ""} generated as per the rules specified by the partition authority URI schema.`, {
            isDuplicateable: false,
            immediateDefaultValue: null,
          },
      ),

      ...generatedField("partitionHeadId", new GraphQLNonNull(GraphQLID),
          `The id of the latest event recorded in this ${objectDescription}.`,
          partitionHeadEventIdResolver,
      ),

// TODO(iridian): Implement partitions.
      ...generatedField("partitionSnapshot", new GraphQLNonNull(GraphQLString),
          `JSON containing a minimal elementary TRANSACTED event (containing only
elementary actions) that when executed reconstructs this ${objectDescription} state, without history
and excluding child Partition's (replacing them with reference thunks).`,
          partitionSnapshotResolver,
      ),

// TODO(iridian): Implement partitions.
      ...generatedField("partitionDeepSnapshot", new GraphQLNonNull(GraphQLString),
          `JSON containing a minimal elementary TRANSACTED event (containing only
elementary actions) that when executed reconstructs this ${objectDescription} state, without history
but which includes the full state of child Partition's as well.`,
          partitionDeepSnapshotResolver,
      ),
    }),

    resolveType: typeNameResolver,
  };
}

export default new GraphQLInterfaceType(partitionInterface());
