import { signVPlot } from "~/security/signatures";

import { obtainAspect, swapAspectRoot } from "~/sourcerer/tools/EventAspects";
import type FalseProphetConnection from "./FalseProphetConnection";

export function _resolveAuthorParams (connection: FalseProphetConnection, op: Object) {
  const mediator = connection._resolveOptionsIdentity(op.options);
  const identityParams = mediator && mediator.try(connection.getChronicleURI());
  console.log("resolveAuthorParams:", connection.getChronicleURI(), identityParams);
  let rejection;
  if (!identityParams) {
    // TODO: check if the connection requires authoring
    if (!connection._requireAuthoredEvents) return undefined;
    rejection = "no public identity found and VChronicle:requireAuthoredEvents is set";
  } else {
    const publicIdentity = identityParams.publicIdentity.vrid();
    if (!rejection) {
      return { publicIdentity, secretKey: identityParams.secretKey };
    }
  }
  const error = new Error(
      `Cannot author an event to <${connection.getChronicleURI()}>: ${rejection}`);
  error.progressUpdate = { isSchismatic: true, isRevisable: false, isReformable: false };
  throw error;
}

// export function _autoAddContributorRelation (connection, op, identityParams) {}

// export function _autoRefreshContributorRelation (connection, op, identityParams) {}

export function _addAuthorAspect (connection, op, authorParams, event, index) {
  const command = obtainAspect(event, "command");
  const author = obtainAspect(event, "author");
  swapAspectRoot("event", event, "author");
  author.antecedent = index - 1;
  author.publicIdentity = authorParams.publicIdentity;
  author.signature = signVPlot({ command, event }, authorParams.secretKey);
  swapAspectRoot("author", author, "event");
}
