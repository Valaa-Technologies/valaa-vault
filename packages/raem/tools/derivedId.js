// @flow

import crypto from "crypto";

import { coerceAsVRID } from "~/raem/VPath";

// IMPORTANT! This function must not be changed because DUPLICATED and ghost id's break.
//
// FIXME(iridian): Add the list of created object id's to top-level DUPLICATED so that it is not
// dependent on an algorithm (besides determinism): when reducing the DUPLICATED as a command,
// accumulate a list of ids in the top-level command. Sub-sequent executions shall then fetch the
// ids from there in order.
export default function derivedId (id, derivationName, contextId = "") {
  if (contextId[0] !== "@") {
    const hash = crypto.createHash("sha256");
    hash.update(id + derivationName + contextId, "ascii");
    return hash.digest("base64");
  }
  return derivedVRID(coerceAsVRID(id), derivationName, contextId);
}

export function derivedVRID (vrid, derivationName, contextVRID) {
  return `${contextVRID.slice(0, -2)}@_:${derivationName}${
    (vrid[1] !== "$") ? vrid : `@_${vrid.slice(1)}`}`;
}
