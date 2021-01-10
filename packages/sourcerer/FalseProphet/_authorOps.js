import { signVPlot } from "~/security/signatures";

import { obtainAspect, swapAspectRoot } from "~/sourcerer/tools/EventAspects";
import type FalseProphetConnection from "./FalseProphetConnection";

export function _resolveAuthorParams (connection: FalseProphetConnection, op: Object) {
  const mediator = connection._resolveOptionsIdentity(op.options);
  const identityParams = mediator && mediator.try(connection.getChronicleURI());
  console.log("resolveAuthorParams:", connection.getChronicleURI(), identityParams);
  let rejection;
  const state = op.options.prophecy._prophecy.state;
  const requireAuthoredEvents = state.getIn([
    "Property", `${connection._rootStem}@.$VChronicle.requireAuthoredEvents@@`, "value", "value",
  ]);
  if (!identityParams) {
    // TODO: check if the connection requires authoring
    if (!requireAuthoredEvents) return undefined;
    rejection = "no public identity found and VChronicle:requireAuthoredEvents is set";
  } else {
    const publicIdentity = identityParams.publicIdentity.vrid();
    const chroniclePublicKey = state.getIn([
      "Property", `${connection._rootStem}@-$VChronicle.director$.@.$V.target${
          publicIdentity.slice(1, -2)}@@@.$.publicKey@@`, "value", "value",
    ]) || state.getIn([
      "Property", `${connection._rootStem}@-$VChronicle.contributor$.@.$V.target${
          publicIdentity.slice(1, -2)}@@@.$.publicKey@@`, "value", "value",
    ]);
    if (!chroniclePublicKey) {
      if (!requireAuthoredEvents) return undefined;
      // TODO: add VChronicle:allowGuestContributors which when set
      // permits automatic identity relation creation into the event
      rejection = `No VChronicle:contributor found targeting the authority public identity${
        ""} (and VChronicle:allowGuestContributors not set)`;
      // _autoAddContributorRelation(connection, op, identityParams);
    } else if (chroniclePublicKey !== identityParams.asContributor.publicKey) {
      // TODO: auto-refresh identity relation public key if the chronicle permits it
      rejection = "Obsolete VChronicle:contributor publicKey (auto-refresh not implemented)";
    }
    if (!rejection) {
      return { publicIdentity, secretKey: identityParams.secretKey };
    }
  }
  const error = new Error(
      `Cannot author an event to <${connection.getChronicleURI()}>: ${rejection}`);
  error.updateProgress = { isSchismatic: true, isRevisable: false, isReformable: false };
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
