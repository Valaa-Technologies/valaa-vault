// @flow

import { coerceAsVRID } from "~/plot";

import { hash40 } from "~/security/hash";

/**
 * Note: this method is backwards compatible with event version 0.2
 * which was very lenient in resource id naming.
 *
 * @export
 * @param {string} commandId
 * @param {string} chronicleURI
 * @param {?number} resourceIndexInCommand
 * @returns
 */
export default function createVRID0Dot3 (
    commandId: string, chronicleId: string, resourceIndexInCommand: ?number) {
  if (typeof commandId !== "string") throw new Error("commandId is not a string");
  if (typeof chronicleId !== "string") throw new Error("chronicleId is not a string");
  if (!Number.isInteger(resourceIndexInCommand)
      || !(resourceIndexInCommand >= 0) || !(resourceIndexInCommand < 65536)) {
    throw new Error(`resourceIndexInCommand is not an integer between 0 and 65535, got: ${
        resourceIndexInCommand}`);
  }
  const id = hash40(
      `chronicle-${chronicleId
        } command-${commandId
        } index-${String(resourceIndexInCommand)}`);
  return `@$~res.${id}@@`;
}

export function createChronicleRootVRID0Dot3 (authorityURI: string, identityMediator: Object,
    commandId: string, chronicleIndexInCommand: ?number) {
  if (typeof authorityURI !== "string" || authorityURI.length > 128) {
    throw new Error("authorityURI is not a string of max length 128");
  }
  if (authorityURI.indexOf(" ") !== -1) {
    throw new Error("Invalid authorityURI: contains a space character");
  }
  const creatorId = (identityMediator.tryClaimsForAuthority(authorityURI) || {}).publicIdentity
      || "";
  if (typeof creatorId !== "string" || creatorId.length > 128) {
    throw new Error("creatorId is not a string of max length 128");
  }
  if (typeof commandId !== "string" || commandId.length > 128) {
    throw new Error("commandId is not a string of max length 128");
  }
  if (!Number.isInteger(chronicleIndexInCommand)
      || !(chronicleIndexInCommand >= 0) || !(chronicleIndexInCommand < 65536)) {
    throw new Error(`chronicleIndexInCommand is not an integer between 0 and 65535, got: ${
      chronicleIndexInCommand}`);
  }
  const id = hash40(
      `authority-${authorityURI
        } creator-${creatorId
        } command-${commandId
        } index-${String(chronicleIndexInCommand)}`);
  return `@$~cro.${id}@@`;
}

export function upgradeVRIDTo0Dot2 (version0Dot2RawId) {
  return coerceAsVRID(version0Dot2RawId);
}
