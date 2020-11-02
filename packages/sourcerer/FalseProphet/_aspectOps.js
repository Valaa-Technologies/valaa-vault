// @flow

import { formVPlot } from "~/plot";
import { signVPlot, verifyVPlotSignature } from "~/security/signatures";
import { hashVPlot } from "~/security/hash";

import {
  obtainAspect, swapAspectRoot, obtainAspectRoot, trySwapAspectRoot,
} from "~/sourcerer/tools/EventAspects";
import type FalseProphetConnection from "./FalseProphetConnection";

import { dumpObject } from "~/tools";

export function _resolveProclaimAspectParams (connection: FalseProphetConnection, op: Object) {
  const unconfirmeds = connection._unconfirmedCommands;
  const aspectParams = {
    index: connection._headEventId + unconfirmeds.length,
  };
  if (!connection.isRemoteAuthority()) return aspectParams;

  const mediator = connection._resolveOptionsIdentity(op.options);
  const identityParams = mediator && mediator.try(connection.getChronicleURI());
  if (identityParams) {
    aspectParams.publicIdentity = identityParams.publicIdentity.vrid();
    aspectParams.publicKey = (identityParams.asContributor || {}).publicKey;
    aspectParams.secretKey = identityParams.secretKey;
  }

  const previousEvent = unconfirmeds.length
      ? unconfirmeds[unconfirmeds.length - 1]
      : connection._latestTruth;
  aspectParams.predecessorLog = ((previousEvent || {}).aspects || {}).log || null;

  const { previousState, state } = op.options.prophecy;
  const rejection = _validateRoleAndRefreshChroniclePublicKey(
      connection, aspectParams, previousState, state,
      (op.options.chronicleInfo || {}).updatesVChronicle, connection._bypassLocalAuthorChecks);
  if (rejection) {
    const error = new Error(`Cannot author an event to <${connection.getChronicleURI()}>: ${
        rejection}`);
    error.updateProgress = { isSchismatic: true, isRevisable: false, isReformable: false };
    throw error;
  }

  return aspectParams;
}

function _validateRoleAndRefreshChroniclePublicKey (
    connection, aspectParams, previousState, state, updatesVChronicle, bypassLocalAuthorChecks) {
  const requireAuthoredEvents = state.getIn([
    "Property", `${connection._rootStem}@.$VChronicle.requireAuthoredEvents@@`, "value", "value",
  ]);
  if (!aspectParams.publicIdentity) {
    if (!requireAuthoredEvents) return null;
    return "No public identity found and VChronicle:requireAuthoredEvents is set";
  }

  const chronicleDirectorKey = _getPublicKeyFromChronicle(aspectParams.publicIdentity,
    // Always sign and validate using previous director key except for first event
      (aspectParams.index === 0) ? state : previousState, connection._rootStem, "director");
  if (updatesVChronicle && !bypassLocalAuthorChecks) {
    if (!chronicleDirectorKey) {
      return `No VChronicle:director identity found when modifying a VChronicle resource`;
    }
    if (updatesVChronicle.requiresDirector
        && (updatesVChronicle.requiresDirector !== aspectParams.publicIdentity)) {
      return `Incongruent VChronicle:director identity encountered ${
        ""}when modifying a VChronicle:director resource`;
    }
  }
  const chroniclePublicKey = chronicleDirectorKey || _getPublicKeyFromChronicle(
      aspectParams.publicIdentity, state, connection._rootStem, "contributor");
  if (!chroniclePublicKey) {
    aspectParams.publicIdentity = null;
    if (requireAuthoredEvents) {
      // TODO(iridian, 2020-10): add VChronicle:allowGuestContributors which when set
      // permits automatic identity relation creation into the event
      // _autoAddContributorRelation(connection, op, identityParams);
      return `No VChronicle:contributor found targeting the authority public identity${
        ""} (and VChronicle:allowGuestContributors not set)`;
    }
  } else if (chroniclePublicKey !== aspectParams.publicKey) {
    if (aspectParams.publicKey && !bypassLocalAuthorChecks) {
    // TODO(iridian, 2020-10): auto-refresh identity relation public key if permitted
      return "Obsolete VChronicle:contributor publicKey (auto-refresh not implemented)";
    }
    aspectParams.publicKey = chroniclePublicKey;
  }
  return null;
}

function _getPublicKeyFromChronicle (publicIdentity, state, chronicleRootIdStem, role) {
  return state.getIn([
    "Property", `${chronicleRootIdStem}@-$VChronicle.${role}$.@.$V.target${
        publicIdentity.slice(1)}@.$.publicKey@@`, "value", "value",
  ]);
}

// export function _autoAddContributorRelation (connection, op, identityParams) {}

// export function _autoRefreshContributorRelation (connection, op, identityParams) {}

export function _validateAspects (connection, event, previousState, state, previousEvent) {
  if (!connection.isRemoteAuthority()) return true;
  let invalidationReason;
  try {
    invalidationReason = _validateAuthorAspect(connection, event, previousState, state)
        || _validateLogAspect(connection, event, previousEvent);
  } catch (error) {
    connection.outputErrorEvent(
        connection.wrapErrorEvent(error, 0, "_validateAspects",
            "\n\tevent:", ...dumpObject(event)), 0,
        "Exception caught when checking and validating aspects");
    invalidationReason = `Internal error caught during invalidation: ${error.message}`;
  }
  if (invalidationReason === undefined) return true;
  connection.warnEvent(1, () => [
    "Connection invalidated:", invalidationReason,
    "\n\tevent:", ...dumpObject(event),
    new Error().stack,
  ]);
  connection.setInvalidated(invalidationReason, event);
  return false;
}

export function _addAuthorAspect (connection, op, aspectParams, event) {
  const command = obtainAspect(event, "command");
  const author = obtainAspect(event, "author");
  swapAspectRoot("author", event, "event");
  try {
    if (aspectParams.index) author.antecedent = aspectParams.index - 1;
    author.publicIdentity = aspectParams.publicIdentity;
    author.signature = signVPlot({ command, event }, aspectParams.secretKey);
  } finally {
    swapAspectRoot("event", author, "author");
  }
}

function _validateAuthorAspect (connection, event, previousState, state) {
  if (connection.isInvalidated()) return "Chronicle invalidated by an earlier event";
  if (event.type === "INVALIDATED") return event.invalidationReason || "INVALIDATED reason missing";
  const stem = connection._rootStem;
  const author = trySwapAspectRoot("author", event, "event");
  if (!author) {
    if (state.getIn(
        ["Property", `${stem}@.$VChronicle.requireAuthoredEvents@@`, "value", "value"])) {
      return "AuthorAspect missing although required by VChronicle:requireAuthoredEvents";
    }
  } else {
    try {
      const command = obtainAspect(author, "command");
      const meta = event.meta;
      delete event.meta;

      const aspectParams = {
        index: author.aspects.log.index,
        publicIdentity: author.publicIdentity,
      };

      const invalidation = _validateRoleAndRefreshChroniclePublicKey(
          connection, aspectParams, previousState, state, (meta || {}).updatesVChronicle);
      if (invalidation) return invalidation;
      if (!aspectParams.publicKey) return "Can't find the author public key from the chronicle";
      if (!verifyVPlotSignature({ event, command }, author.signature, aspectParams.publicKey)) {
        return "Invalid VLog:signature";
      }
      event.meta = meta;
    } finally {
      swapAspectRoot("event", author, "author");
    }
  }
  if (event.type === "SEALED") return event.invalidationReason || "SEALED reason missing";
  return undefined;
}

export function _addLogAspect (connection, op, aspectParams, event) {
  const log = obtainAspectRoot("log", event, "event");
  try {
    log.index = aspectParams.index;
    if (aspectParams.predecessorLog !== undefined) {
      log.chainHash = _calculateChainHash(event, log.aspects.author, aspectParams.predecessorLog);
    }
    connection.debugEvent(3, () => [
      "VLog:chainHash added:", log.chainHash,
      "\n\tpredecessorLog:", aspectParams.predecessorLog,
      "\n\tevent:", ...dumpObject(event),
      "\n\tevent:", JSON.stringify(event),
    ]);
  } finally {
    swapAspectRoot("event", log, "log");
  }
}

function _validateLogAspect (connection, event, predecessor) {
  const log = swapAspectRoot("log", event, "event");
  const chainHash = log.chainHash
      && _calculateChainHash(event, log.aspects.author, predecessor && predecessor.aspects.log);
  swapAspectRoot("event", log, "log");
  if (chainHash === log.chainHash) return undefined;
  connection.errorEvent(0, () => [
    "VLog:chainHash mismatch, got:", chainHash, ", expected:", log.chainHash,
    "\n\tpredecessorLog:", ...dumpObject(predecessor && predecessor.aspects.log),
    "\n\tevent:", ...dumpObject(event),
  ]);
  return "Invalid VLog:chainHash";
}

function _calculateChainHash (event, authorAspect, predecessorLogAspect) {
  const chainHash = (predecessorLogAspect || {}).chainHash;
  const predecessorStep = !chainHash ? "" : `@.$VLog.chainHash$.${chainHash}`;
  let eventStep = (authorAspect || {}).signature
      && `@.$VLog.signature$.${(authorAspect || {}).signature}`;
  if (!eventStep) {
    const meta = event.meta;
    delete event.meta;
    eventStep = `@.$VLog.event$.${formVPlot(event)}`;
    event.meta = meta;
  }
  const ret = hashVPlot(`${predecessorStep}${eventStep}@@`, { isValidVPlot: true });
  /*
  console.log("VLog:chainHash:", ret,
      "\n\tvplot:", `${predecessorStep}${eventStep}@@`,
      "\n\tevent:", JSON.stringify(plotEvent, null, 2),
      );
  */
  return ret;
}
