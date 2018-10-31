// @flow

import { EventBase } from "~/raem/command";

import PartitionConnection from "~/prophet/api/PartitionConnection";
import { dumpObject } from "~/tools";

import extractEventOfPartition from "./extractEventOfPartition";

export default function upgradeEventToVersion0dot2 (event: EventBase,
    connection: PartitionConnection) {
  try {
    if (event.version === "0.2") return event;
    let ret;
    if (event.version === "0.1") {
      ret = extractEventOfPartition(event, connection, connection.getPartitionRawId());
    } else {
      throw new Error(`Unrecognized event version "${event.version
          }" when trying to upgrade event to version 0.2`);
    }
    // if (!ret) return ret;
    ret.version = "0.2";
    return ret;
  } catch (error) {
    throw connection.wrapErrorEvent(error, new Error("upgradeEventToVersion0dot2()"),
      "\n\tevent:", ...dumpObject(event),
      "\n\tevent.partitions:", ...dumpObject(event.partitions),
      "\n\tconnection:", connection.getName());
  }
}
