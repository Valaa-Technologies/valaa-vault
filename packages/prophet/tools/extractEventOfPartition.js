// @flow

import { Action, isTransactedLike } from "~/raem/command";

import PartitionConnection from "~/prophet/api/PartitionConnection";

import { dumpObject } from "~/tools";

export default function extractEventOfPartition (action: Action,
    connection: PartitionConnection, partitionKey: string = String(connection.getPartitionURI())) {
  let ret;
  try {
    if (!action.partitions) return action;
    const partitionData = action.partitions[partitionKey];
    if (!partitionData) return undefined;
    ret = { ...action };
    delete ret.partitions;
    if (ret.version) {
      ret.eventId = partitionData.eventId;
    } else {
      // TODO(iridian): Fix @valos/raem so that it doesn't generate commandId for sub-actions.
      delete ret.commandId;
    }
    if (Object.keys(action.partitions).length !== 1) {
      if (!isTransactedLike(action)) {
        throw new Error("Non-TRANSACTED-like multipartition proclamations are not supported");
      }
      ret.actions = action.actions
          .map(subAction => extractEventOfPartition(subAction, connection, partitionKey))
          .filter(notFalsy => notFalsy);
      if (!ret.actions.length) {
        throw new Error(`INTERNAL ERROR: No TRANSACTED-like.actions found for current partition ${
            ""}in a multi-partition TRANSACTED-like action`);
      }
    }
    return ret;
  } catch (error) {
    throw connection.wrapErrorEvent(error,
        new Error(`extractEventOfPartition(${connection.getName()})`),
        "\n\tpartitionKey:", partitionKey,
        "\n\tproclamation:", ...dumpObject(action),
        "\n\tproclamation partitions:", ...dumpObject(action.partitions),
        "\n\tcurrent ret:", ...dumpObject(ret),
    );
  }
}
