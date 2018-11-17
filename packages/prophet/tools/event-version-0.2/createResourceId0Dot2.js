// @flow

import createValOSHash from "~/prophet/tools/createValOSHash";

export default function createResourceId0Dot2 (commandId: string, partitionURI: string,
    intraEventIndex: ?number) {
  if (typeof commandId !== "string") throw new Error("commandId is not a string");
  if (typeof partitionURI !== "string") throw new Error("partitionURI is not a string");
  if (!Number.isInteger(intraEventIndex) || !(intraEventIndex >= 0) || !(intraEventIndex < 65536)) {
    throw new Error("intraEventIndex is not an integer between 0 and and 65535");
  }
  return createValOSHash(`${commandId} ${partitionURI} ${String(intraEventIndex)}`);
}

export function createPartitionId0Dot2 (commandId: string, partitionAuthorityURI: string) {
  return createValOSHash(`${commandId} ${partitionAuthorityURI} partition`);
}
