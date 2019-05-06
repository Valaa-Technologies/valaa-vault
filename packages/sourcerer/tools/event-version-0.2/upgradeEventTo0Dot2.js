// @flow

import { Action, EventBase } from "~/raem/events";
import createValidateEventMiddleware from "~/raem/redux/middleware/validateEvent";

import SourcererContentAPI from "~/sourcerer/SourcererContentAPI";
import Connection from "~/sourcerer/api/Connection";

import { dumpify, dumpObject } from "~/tools";

import extractPartitionEvent0Dot2 from "./extractPartitionEvent0Dot2";

const validateAnyVersion = createValidateEventMiddleware(
    SourcererContentAPI.validators, "0.2")()(event => event);

export default function upgradeEventTo0Dot2 (connection: Connection, event: EventBase) {
  let ret;
  try {
    validateAnyVersion(event);
    if (event.aspects && (event.aspects.version === "0.2")) return event;
    if (event.version === "0.1") {
      ret = convertEvent0Dot1To0Dot2(connection, event);
      const extracted = extractPartitionEvent0Dot2(connection, ret, connection.getPartitionRawId());
      if (!extracted) {
        throw new Error("Could not extract partition event while upgrading event from version 0.1");
      }
      ret = extracted;
    } else {
      throw new Error(`Unrecognized event version "${event.version || (event.aspects || {}).version
          }" when trying to upgrade event to version 0.2`);
    }
    validateAnyVersion(ret);
    return ret;
  } catch (error) {
    throw connection.wrapErrorEvent(error,
        new Error(`upgradeEventTo0Dot2(${connection.getName()})`),
        "\n\tpartitionRawId:", connection.getPartitionRawId(),
        "\n\tpartitionURI:", ...dumpObject(connection.getPartitionURI()),
        "\n\tevent:", ...dumpObject(event),
        "\n\tevent.partitions:", dumpify(event.partitions),
        "\n\tret (partial):", JSON.stringify(ret, null, 2));
  }
}

export function convertEvent0Dot1To0Dot2 (connection: Connection,
    action: Action, isRoot: boolean = true) {
  let ret;
  try {
    ret = {
      ...action,
    };
    delete ret.version;
    const partitions = ret.partitions;
    delete ret.partitions;
    if (isRoot) {
      const partition = partitions[connection.getPartitionRawId()];
      ret.meta = {};
      ret.aspects = {
        version: "0.2",
        command: { id: ret.commandId },
        log: {
          index: partition.eventId,
          timeStamp: ret.timeStamp,
        },
      };
      delete ret.timeStamp;
    }
    delete ret.commandId;
    if (ret.type === "DESTROYED") delete ret.typeName;
    if (ret.type === "MODIFIED") {
      if (ret.sets && !ret.adds && !ret.removes) ret.type = "FIELDS_SET";
      else if (ret.removes && ret.adds && !ret.sets) ret.type = "REPLACED_WITHIN";
      else if (ret.adds && !ret.removes && !ret.sets) ret.type = "ADDED_TO";
      else if (ret.removes && !ret.adds && !ret.sets) ret.type = "REMOVED_FROM";
      else {
        throw new Error(`Cannot upgrade event type 'MODIFIED' as it has unsupported ${
          ""} configuration of 'sets', 'adds' and 'removes' fields`);
      }
    }
    if (ret.actions) {
      ret.actions = action.actions.map(subAction =>
          convertEvent0Dot1To0Dot2(connection, subAction, false));
    }
    return ret;
  } catch (error) {
    throw connection.wrapErrorEvent(error,
        new Error(`convertEvent0Dot1To0Dot2()`),
        "\n\taction:", ...dumpObject(action),
        "\n\tret (partial):", ...dumpObject(ret),
    );
  }
}
