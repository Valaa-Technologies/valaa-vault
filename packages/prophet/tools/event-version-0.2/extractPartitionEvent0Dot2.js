// @flow

import { Action, isTransactedLike } from "~/raem/events";

import PartitionConnection from "~/prophet/api/PartitionConnection";

import { dumpObject } from "~/tools";

export default function extractPartitionEvent0Dot2 (connection: PartitionConnection, action: Action,
    partitionKey: string = String(connection.getPartitionURI())) {
  const local = action.local;
  if (!local) return action;
  const partitions = action.local.partitions;
  try {
    if (partitions && partitionKey && !partitions[partitionKey]) return undefined;
    const ret = { ...action };
    delete ret.local;
    if (!partitions) return ret;
    if (Object.keys(partitions).length !== 1) {
      if (!isTransactedLike(action)) {
        throw new Error("Non-TRANSACTED-like multi-partition commands are not supported");
      }
      if (action.type !== "TRANSACTED") {
        throw new Error(`Multi-partition ${action.type} not implemented`);
      }
      ret.actions = action.actions
          .map(subAction => extractPartitionEvent0Dot2(connection, subAction, partitionKey))
          .filter(notFalsy => notFalsy);
      if (!ret.actions.length) {
        throw new Error(`INTERNAL ERROR: No TRANSACTED.actions found for current partition ${
            ""}in a multi-partition TRANSACTED action`);
      }
    } else if (isTransactedLike(ret)) {
      ret.actions = action.actions.map(subAction =>
          extractPartitionEvent0Dot2(connection, subAction));
      if ((ret.type === "TRANSACTED") && (ret.actions.length === 1)) {
        const simplifiedAction = ret.actions[0];
        delete ret.actions;
        Object.assign(ret, simplifiedAction);
      }
    }
    return ret;
  } catch (error) {
    throw connection.wrapErrorEvent(error,
        new Error(`extractPartitionEvent0Dot2(${connection.getName()})`),
        "\n\tpartitionKey:", partitionKey,
        "\n\taction:", ...dumpObject(action),
        "\n\taction partitions:", ...dumpObject(partitions),
        "\n\tcurrent ret:", ...dumpObject(ret),
    );
  }
}
