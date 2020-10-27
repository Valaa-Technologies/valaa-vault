// @flow

import { coerceAsVRID } from "~/plot";
import { b64SHA256FromUTF8Text } from "~/security/hash";

// IMPORTANT! This function must not be changed because DUPLICATED and ghost id's break.
//
// FIXME(iridian): Add the list of created object id's to top-level DUPLICATED so that it is not
// dependent on an algorithm (besides determinism): when reducing the DUPLICATED as a command,
// accumulate a list of ids in the top-level command. Sub-sequent executions shall then fetch the
// ids from there in order.

export default function derivedId (id, derivationName, contextId = "") {
  return (contextId[0] !== "@")
      ? b64SHA256FromUTF8Text(id + derivationName + contextId)
      : derivedVRID(coerceAsVRID(id), derivationName, contextId);
}

export function derivedVRID (vrid, derivationName, contextVRID) {
  return `${contextVRID.slice(0, -2)}@_$.${derivationName}${
    (vrid[1] !== "$") ? vrid : `@_${vrid.slice(1)}`}`;
}
