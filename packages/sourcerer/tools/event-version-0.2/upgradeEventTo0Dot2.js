// @flow

import { Action, EventBase } from "~/raem/events";
import createValidateEventMiddleware from "~/raem/redux/middleware/validateEvent";

import SourcererContentAPI from "~/sourcerer/SourcererContentAPI";
import Connection from "~/sourcerer/api/Connection";

import { dumpify, dumpObject } from "~/tools";

import extractChronicleEvent0Dot2 from "./extractPartitionEvent0Dot2";

const validateAnyVersion = createValidateEventMiddleware(
    SourcererContentAPI.validators, "0.2")()(event => event);

export default function upgradeEventTo0Dot2 (connection: Connection, event: EventBase) {
  let ret;
  try {
    validateAnyVersion(event);
    if (event.aspects && (event.aspects.version === "0.2")) return event;
    if (event.version === "0.1") {
      ret = convertEvent0Dot1To0Dot2(connection, event);
      const extracted = extractChronicleEvent0Dot2(connection, ret);
      if (!extracted) {
        throw new Error("Could not extract chronicle event while upgrading event from version 0.1");
      }
      ret = extracted;
    } else {
      throw new Error(`Unrecognized event version "${event.version || (event.aspects || {}).version
          }" when trying to upgrade event to version 0.2`);
    }
    validateAnyVersion(ret);
    return ret;
  } catch (error) {
    throw connection.wrapErrorEvent(error, 1,
        new Error(`upgradeEventTo0Dot2(${connection.getName()})`),
        "\n\tchronicleId:", connection.getChronicleId(),
        "\n\tchronicleURI:", ...dumpObject(connection.getChronicleURI()),
        "\n\tevent:", ...dumpObject(event),
        "\n\tevent.partitions:", dumpify(event.partitions),
        "\n\tret (partial):", JSON.stringify(ret, null, 2));
  }
}

export function convertEvent0Dot1To0Dot2 (connection: Connection,
    action: Action, isRoot: boolean = true) {
  let ret;
  try {
    const { type, version, commandId, timeStamp, partitions, ...eventAspectFields } = action;
    ret = {
      type: action.type,
      ...(isRoot ? {
        aspects: {
          version: "0.2",
          command: { id: commandId, timeStamp },
          log: { index: partitions[_partitionKey(connection)].eventId, timeStamp },
        },
      } : {}),
      ...eventAspectFields,
      ...(partitions ? {
        meta: {
          chronicleURI: connection.getChronicleURI(),
          chronicles: { [connection.getChronicleURI()]: partitions[_partitionKey(connection)] },
        }
      } : {})
    };
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
    throw connection.wrapErrorEvent(error, 1,
        new Error(`convertEvent0Dot1To0Dot2()`),
        "\n\taction:", ...dumpObject(action),
        "\n\tret (partial):", ...dumpObject(ret),
    );
  }
}

function _partitionKey (connection) {
  const partitionKey = connection.getChronicleId();
  return (partitionKey[0] === "@")
      ? partitionKey.match(/^@\$~[^.]*\.([^@]*)@@$/)[1]
      : partitionKey;
}
