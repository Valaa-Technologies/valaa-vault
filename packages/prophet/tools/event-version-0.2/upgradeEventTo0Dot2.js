// @flow

import { EventBase } from "~/raem/events";

import PartitionConnection from "~/prophet/api/PartitionConnection";
import { dumpObject } from "~/tools";

import extractPartitionEvent0Dot2 from "./extractPartitionEvent0Dot2";

export default function upgradeEventTo0Dot2 (event: EventBase, connection: PartitionConnection) {
  try {
    if (event.version === "0.2") {
      if (!event.commandId) throw new Error("invalid version 0.2 event: .commandId missing");
      return event;
    }
    let ret;
    if (event.version === "0.1") {
      ret = extractPartitionEvent0Dot2(event, connection, connection.getPartitionRawId());
    } else {
      throw new Error(`Unrecognized event version "${event.version
          }" when trying to upgrade event to version 0.2`);
    }
    // if (!ret) return ret;
    ret.version = "0.2";
    return ret;
  } catch (error) {
    throw connection.wrapErrorEvent(error, new Error("upgradeEventTo0Dot2()"),
      "\n\tevent:", ...dumpObject(event),
      "\n\tevent.partitions:", ...dumpObject(event.partitions),
      "\n\tconnection:", connection.getName());
  }
}
