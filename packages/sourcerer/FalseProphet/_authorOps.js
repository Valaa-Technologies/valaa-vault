import { signVPlot } from "~/security/signatures";

import { obtainAspect, swapAspectRoot } from "~/sourcerer/tools/EventAspects";
import type FalseProphetConnection from "./FalseProphetConnection";

import { dumpObject } from "~/tools";

export function _resolveAuthorParams (connection: FalseProphetConnection, op: Object) {
  const mediator = connection._resolveOptionsIdentity(op.options);
  const identityParams = mediator && mediator.try(connection.getChronicleURI());
  let rejection;
  const state = op.options.stateAfter;
  const requireAuthoredEvents = state.getIn([
    "Property", `${connection._rootStem}@.$VChronicle.requireAuthoredEvents@@`, "value", "value",
  ]);
  if (!identityParams) {
    if (!requireAuthoredEvents) return undefined;
    rejection = "no public identity found and VChronicle:requireAuthoredEvents is set";
  } else {
    const publicIdentity = identityParams.publicIdentity.vrid();
    const chroniclePublicKey = _getPublicKeyFromChronicle(
        publicIdentity, state, connection._rootStem);
    if (!chroniclePublicKey) {
      if (!requireAuthoredEvents) return undefined;
      // TODO(iridian, 2020-10): add VChronicle:allowGuestContributors which when set
      // permits automatic identity relation creation into the event
      rejection = `No VChronicle:contributor found targeting the authority public identity${
        ""} (and VChronicle:allowGuestContributors not set)`;
      // _autoAddContributorRelation(connection, op, identityParams);
    } else if (chroniclePublicKey !== identityParams.asContributor.publicKey) {
      // TODO(iridian, 2020-10): auto-refresh identity relation public key if the chronicle permits
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

function _getPublicKeyFromChronicle (publicIdentity, state, chronicleRootIdStem) {
  return state.getIn([
    "Property", `${chronicleRootIdStem}@-$VChronicle.director$.@.$V.target${
        publicIdentity.slice(1)}@.$.publicKey@@`, "value", "value",
  ]) || state.getIn([
    "Property", `${chronicleRootIdStem}@-$VChronicle.contributor$.@.$V.target${
        publicIdentity.slice(1)}@.$.publicKey@@`, "value", "value",
  ]);
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

export function _validateAuthorAspect (connection, state, event) {
  let invalidation;
  try {
    if (connection.isInvalidated()) {
      invalidation = "Chronicle invalidated by an earlier event";
    } else if (event.type === "INVALIDATED") {
      invalidation = event.invalidationReason;
    } else {
      const author = event.aspects.author;
      const stem = connection._rootStem;
      if (!author && state
          .getIn(["Property", `${stem}@.$VChronicle.requireAuthoredEvents@@`, "value", "value"])) {
        invalidation = "AuthorAspect missing while required by $VChronicle.requireAuthoredEvents";
      }
    }
    if (!invalidation && (event.type === "SEALED")) {
      invalidation = event.invalidationReason;
    }
  } catch (error) {
    connection.outputErrorEvent(
        connection.wrapErrorEvent(error, 0, "_validateAuthorAspect",
            "\n\tevent:", ...dumpObject(event)), 0,
        "Exception caught when checking and validating author aspect");
    invalidation = `Internal error caught during invalidation: ${error.message}`;
  }
  if (!invalidation) return true;
  connection.warnEvent(1, () => [
    "Connection invalidated:", invalidation,
    "\n\tevent:", ...dumpObject(event),
    new Error().stack,
  ]);
  connection.setInvalidated(invalidation, event);
  return false;
}
