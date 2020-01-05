// @flow

import { coerceAsVRID } from "~/raem/VPath";

import hashV240 from "~/sourcerer/tools/hashV240";

/**
 * Note: this method is backwards compatible with event version 0.2
 * which was very lenient in resource id naming.
 *
 * @export
 * @param {string} commandId
 * @param {string} chronicleURI
 * @param {?number} intraEventIndex
 * @returns
 */
export default function createVRID0Dot3 (commandId: string, chronicleURI: string,
    intraEventIndex: ?number) {
  if (typeof commandId !== "string") throw new Error("commandId is not a string");
  if (typeof chronicleURI !== "string") throw new Error("chronicleURI is not a string");
  if (!Number.isInteger(intraEventIndex) || !(intraEventIndex >= 0) || !(intraEventIndex < 65536)) {
    throw new Error(`intraEventIndex is not an integer between 0 and and 65535, got: ${
        intraEventIndex}`);
  }
  return `@$~cih:${hashV240(`${commandId} ${chronicleURI} ${String(intraEventIndex)}`)}@@`;
}

export function createChronicleRootVRID0Dot3 (commandId: string, authorityURI: string) {
  return `@$~chr:${hashV240(`${commandId} ${authorityURI} chronicle`)}@@`;
}

export function upgradeVRIDTo0Dot3 (version0Dot2RawId) {
  return coerceAsVRID(version0Dot2RawId);
}
