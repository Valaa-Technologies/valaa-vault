// @flow

import { Action, isTransactedLike } from "~/raem/events";

import PartitionConnection from "~/prophet/api/PartitionConnection";

import { dumpObject } from "~/tools";

export default function extractPartitionEvent0Dot2 (action: Action,
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
        throw new Error("Non-TRANSACTED-like multipartition commands are not supported");
      }
      ret.actions = action.actions
          .map(subAction => extractPartitionEvent0Dot2(subAction, connection, partitionKey))
          .filter(notFalsy => notFalsy);
      if (!ret.actions.length) {
        throw new Error(`INTERNAL ERROR: No TRANSACTED-like.actions found for current partition ${
            ""}in a multi-partition TRANSACTED-like action`);
      }
    }
    return ret;
  } catch (error) {
    throw connection.wrapErrorEvent(error,
        new Error(`extractPartitionEvent0Dot2(${connection.getName()})`),
        "\n\tpartitionKey:", partitionKey,
        "\n\taction:", ...dumpObject(action),
        "\n\taction partitions:", ...dumpObject(action.partitions),
        "\n\tcurrent ret:", ...dumpObject(ret),
    );
  }
}
