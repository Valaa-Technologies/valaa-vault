// @flow

import hashV240 from "~/sourcerer/tools/hashV240";

export default function createResourceId0Dot2 (commandId: string, chronicleURI: string,
    intraEventIndex: ?number) {
  if (typeof commandId !== "string") throw new Error("commandId is not a string");
  if (typeof chronicleURI !== "string") throw new Error("chronicleURI is not a string");
  if (!Number.isInteger(intraEventIndex) || !(intraEventIndex >= 0) || !(intraEventIndex < 65536)) {
    throw new Error(`intraEventIndex is not an integer between 0 and and 65535, got: ${
        intraEventIndex}`);
  }
  return hashV240(`${commandId} ${chronicleURI} ${String(intraEventIndex)}`);
}

export function createChronicleId0Dot2 (commandId: string, authorityURI: string) {
  return hashV240(`${commandId} ${authorityURI} chronicle`);
}
