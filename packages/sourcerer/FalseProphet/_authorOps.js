import { signVPlot, verifyVPlotSignature } from "~/security/signatures";

import { obtainAspect, swapAspectRoot } from "~/sourcerer/tools/EventAspects";
import type FalseProphetConnection from "./FalseProphetConnection";

import { dumpObject } from "~/tools";

export function _resolveAuthorParams (
    connection: FalseProphetConnection, op: Object, index: number) {
  const mediator = connection._resolveOptionsIdentity(op.options);
  const identityParams = mediator && mediator.try(connection.getChronicleURI());
  const { previousState, state } = op.options.prophecy;
  const validationResult = _validateRoleAndGetKey(connection,
      identityParams && identityParams.publicIdentity.vrid(),
      ((identityParams || {}).asContributor || {}).publicKey,
      (identityParams || {}).secretKey,
      index, previousState, state, (op.options.chronicleInfo || {}).updatesVChronicle,
      connection._bypassLocalAuthorChecks);
  if (!validationResult.rejection) return validationResult;
  const error = new Error(`Cannot author an event to <${connection.getChronicleURI()}>: ${
      validationResult.rejection}`);
  error.updateProgress = { isSchismatic: true, isRevisable: false, isReformable: false };
  throw error;
}

function _validateRoleAndGetKey (connection,
    publicIdentity, mediatorPublicKey, secretKey,
    index, previousState, state, updatesVChronicle, bypassLocalAuthorChecks) {
  const requireAuthoredEvents = state.getIn([
    "Property", `${connection._rootStem}@.$VChronicle.requireAuthoredEvents@@`, "value", "value",
  ]);
  if (!publicIdentity) {
    if (!requireAuthoredEvents) return {};
    return { rejection: "no public identity found and VChronicle:requireAuthoredEvents is set" };
  }

  const directorKey = _getPublicKeyFromChronicle(publicIdentity,
    // Always sign and validate using previous director key except for first event
      !index ? state : previousState, connection._rootStem, "director");
  if (!directorKey && updatesVChronicle && !bypassLocalAuthorChecks) {
    return {
      rejection: `No VChronicle:director chronicle identity found${
          ""} while trying to modify a VChronicle field`,
    };
  }
  const publicKey = directorKey
      || _getPublicKeyFromChronicle(publicIdentity, state, connection._rootStem, "contributor");
  if (!publicKey) {
    if (!requireAuthoredEvents) return {};
    // TODO(iridian, 2020-10): add VChronicle:allowGuestContributors which when set
    // permits automatic identity relation creation into the event
    // _autoAddContributorRelation(connection, op, identityParams);
    return {
      rejection: `No VChronicle:contributor found targeting the authority public identity${
          ""} (and VChronicle:allowGuestContributors not set)`,
    };
  }
  if (mediatorPublicKey && (publicKey !== mediatorPublicKey) && !bypassLocalAuthorChecks) {
    // TODO(iridian, 2020-10): auto-refresh identity relation public key if permitted
    return {
      rejection: "Obsolete VChronicle:contributor publicKey (auto-refresh not implemented)",
    };
  }
  return { publicIdentity, publicKey, secretKey };
}

function _getPublicKeyFromChronicle (publicIdentity, state, chronicleRootIdStem, role) {
  return state.getIn([
    "Property", `${chronicleRootIdStem}@-$VChronicle.${role}$.@.$V.target${
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

export function _validateAuthorAspect (connection, event, previousState, state) {
  let invalidation;
  try {
    if (connection.isInvalidated()) {
      invalidation = "Chronicle invalidated by an earlier event";
    } else if (event.type === "INVALIDATED") {
      invalidation = event.invalidationReason;
    } else {
      const author = event.aspects.author;
      const stem = connection._rootStem;
      if (author) {
        const command = obtainAspect(event, "command");
        swapAspectRoot("event", event, "author");
        const meta = event.meta;
        delete event.meta;

        const validationResult = _validateRoleAndGetKey(connection,
            author.publicIdentity, undefined, undefined,
            author.aspects.log.index, previousState, state, (meta || {}).updatesVChronicle);
        invalidation = validationResult.rejection;
        if (!invalidation) {
          if (!validationResult.publicKey) {
            invalidation = "Can't find the author public key from the chronicle";
          } else if (!verifyVPlotSignature(
              { event, command }, author.signature, validationResult.publicKey)) {
            invalidation = "Invalid signature";
          } // else valid
        }

        event.meta = meta;
        swapAspectRoot("author", author, "event");
      } else if (state
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
