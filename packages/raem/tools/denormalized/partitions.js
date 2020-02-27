// @flow

import type { VRL } from "~/raem/VRL"; // eslint-disable-line no-duplicate-imports

import Bard, { getActionFromPassage } from "~/raem/redux/Bard";
import { tryHostRef } from "~/raem/VALK/hostReference";
import { naiveURI } from "~/raem/ValaaURI";
import { Resolver, Transient } from "~/raem/state";

import traverseMaterializedOwnlings
    from "~/raem/tools/denormalized/traverseMaterializedOwnlings";

import { dumpObject, invariantifyArray, thenChainEagerly, unwrapError, wrapError } from "~/tools";

export class AbsentChroniclesError extends Error {
  constructor (message, absentChronicleURIs: (string | Promise<string>)[]) {
    super(message);
    invariantifyArray(absentChronicleURIs, "AbsentChroniclesError.absentChronicleURIs",
        { elementInvariant: value => value });
    this.absentChronicleURIs = absentChronicleURIs;
  }
}

// Wraps the call inside logic which connects to absent chronicles if
// a AbsentChroniclesError is thrown. The connect callback
// is extracted from the error.connectToChronicle itself. Thus for the
// autoconnect functionality to work some intervening layer must add
// this callback into all caught missing connection errors.
export function asyncConnectToChronicleIfAbsentAndRetry (call, onError) {
  if ((typeof call !== "function") || !call.apply) throw new Error("call is not a function");
  return function autoConnectingCall (...args: any[]) {
    return tryCall.call(this, call, onError, ...args);
  };
}

function tryCall (call: any, onError, ...args: any[]) {
  return thenChainEagerly(null, [
    () => call.apply(this, args),
  ], error => {
    if (!(unwrapError(error) instanceof AbsentChroniclesError)) {
      if (onError) return onError(error, ...args);
      throw error;
    }
    try {
      return connectToAbsentChroniclesAndThen(error,
          () => tryCall.call(this, call, onError, ...args));
    } catch (innerError) {
      const wrappedError = wrapError(innerError,
        `During @asyncConnectToChronicleIfAbsentAndRetry(${call.name}):`,
        "\n\thint: use chronicles:addConnectToChronicleToError to add it",
        "\n\tcall:", ...dumpObject(call),
        "\n\targs:", ...dumpObject(args));
      if (onError) return onError(wrappedError, ...args);
      throw wrappedError;
    }
  });
}

export function tryConnectToAbsentChroniclesAndThen (error, callback, explicitConnectToChronicle) {
  const original = error.originalError || error;
  if (!original.absentChronicleURIs) return false;
  return connectToAbsentChroniclesAndThen(error, callback, explicitConnectToChronicle);
}

export function connectToAbsentChroniclesAndThen (error, callback, explicitConnectToChronicle) {
  const original = error.originalError || error;
  const connectToChronicle = original.connectToChronicle || explicitConnectToChronicle;
  if (!connectToChronicle) {
    throw wrapError(error, "caught AbsentChroniclesError",
        "but no error.connectToChronicle found: cannot try connecting");
  }
  if (!original.absentChronicleURIs || !original.absentChronicleURIs.length) {
    throw wrapError(error, "caught AbsentChroniclesError",
            "but error.absentChronicleURIs is missing or empty: cannot try connecting");
  }
  const ret = Promise.all(original.absentChronicleURIs.map(absentChronicleURI =>
      ((typeof absentChronicleURI === "string")
          ? connectToChronicle(absentChronicleURI)
          : absentChronicleURI) // a promise for an already existing connection process
  )).then(() => callback());
  ret.operationInfo = {
    slotName: "pendingConnectionsLens", focus: original.absentChronicleURIs,
    onError: { slotName: "failedConnectionsLens", chronicles: original.absentChronicleURIs },
  };
  return ret;
}

export function addConnectToChronicleToError (error, connectToChronicle) {
  (error.originalError || error).connectToChronicle = connectToChronicle;
  return error;
}


/**
 * Chronicle system
 *
 * The chronicle of a Resource is the innermost owning object (or self)
 * which has Chronicle.authorityURI defined. For all non-ghost
 * Resource's the chronicle is also cached in the
 * id:VRL.getChronicleURI. For ghosts the chronicle can be
 * fetched from the ghost host.
 */

export function universalizeChronicleMutation (bard: Bard, id: VRL) {
  let chronicleURI, targetMeta, enclosingPassage, enclosingChronicleURI;
  const ref = tryHostRef(id);
  try {
    const eventMeta = bard.event.meta;
    if (!eventMeta.isBeingUniversalized || !ref) return undefined;
    if (ref.isAbsent()) throw new Error(`Cannot modify an absent resource <${ref.toString()}>`);
    let smallestNonGhostId = ref;
    chronicleURI = smallestNonGhostId.getChronicleURI();
    if (!chronicleURI && smallestNonGhostId.isGhost()) {
      const hostRawId = smallestNonGhostId.getGhostPath().headHostRawId();
      const resolver = Object.create(bard);
      resolver.goToTransientOfRawId(hostRawId, "Resource");
      smallestNonGhostId = resolver.objectId;
      chronicleURI = smallestNonGhostId.getChronicleURI();
    }
    // Resources without chronicles are allowed but they must be
    // subsequently used in the same transactional event and assigned
    // chronicle to be valid.
    // TODO(iridian): Actually add the validations for detecting
    // dangling chronicleless resources.
    if (!chronicleURI) return undefined;
    let chronicleInfo = (eventMeta.chronicles || {})[chronicleURI];

    // Fill the meta.chronicleURI and meta.chronicles properly
    // Invariant rules:
    // 1. if action.meta doesn't have chronicleURI explicitly defined
    // then its chronicleURI is implicitly the same as the explicitly
    // defined meta.chronicleURI of its nearest parent passage.
    // 2. meta.chronicles contains all chronicleURI's of its children
    // and itself as keys, each with their corresponding chronicle info
    // structure as values. The chronicle info corresponding to a
    // chronicleURI is shared between all actions.

    enclosingPassage = bard.passage;
    while (enclosingPassage) {
      enclosingChronicleURI = (enclosingPassage.meta || {}).chronicleURI;
      if (enclosingChronicleURI) break;
      enclosingPassage = enclosingPassage.parentPassage;
    }
    if (!enclosingPassage && eventMeta.chronicleURI) {
      // This action is materialization or absent transient creation
      // event. Disregard.
      return undefined;
    }
    if (enclosingChronicleURI === chronicleURI) return undefined;
    const action = getActionFromPassage(bard.passage);
    if (!chronicleInfo) {
      chronicleInfo = !bard.createCommandChronicleInfo ? {}
          : bard.createCommandChronicleInfo(chronicleURI, action, bard.event, bard);
    }
    if (!enclosingChronicleURI) {
      targetMeta = eventMeta;
    } else {
      // only modify non-virtual actions
      targetMeta = action && (action.meta || (action.meta = {}));
      // do fill all parents
      const enclosingChronicleInfo = enclosingPassage.meta.chronicles[enclosingChronicleURI];
      let parentFiller = bard.passage.parentPassage;
      for (; // eslint-disable-line no-cond-assign
          !parentFiller.meta || !parentFiller.meta.chronicleURI;
          parentFiller = parentFiller.parentPassage) {
        let parentMeta = parentFiller.meta;
        if (!parentMeta) {
          const parentAction = getActionFromPassage(parentFiller);
          if (!parentAction) continue;
          parentMeta = (parentAction.meta = {});
        }
        parentMeta.chronicleURI = enclosingChronicleURI;
        parentMeta.chronicles = {
          [enclosingChronicleURI]: enclosingChronicleInfo,
          [chronicleURI]: chronicleInfo,
        };
      }
      for (; parentFiller && !parentFiller.meta.chronicles[chronicleURI];
          parentFiller = parentFiller.parentPassage) {
        parentFiller.meta.chronicles[chronicleURI] = chronicleInfo;
      }
    }
    if (targetMeta) {
      if (targetMeta.chronicleURI) {
        throw new Error("Cannot overwrite existing target.meta.chronicleURI");
      }
      targetMeta.chronicleURI = chronicleURI;
      (targetMeta.chronicles || (targetMeta.chronicles = {}))[chronicleURI] = chronicleInfo;
      // TODO(iridian): handle the case where a purged prophecy
      // refabrication results in some partitions being removed.
    }
    return chronicleURI;
  } catch (error) {
    throw bard.wrapErrorEvent(error, 1, () => [
      "universalizeChronicleMutation",
      "\n\tbard:", ...dumpObject(bard),
      "\n\tid:", id,
      "\n\tref:", ...dumpObject(ref),
      "\n\tchronicleURI:", chronicleURI,
      "\n\tbard.passage:", ...dumpObject(bard.passage),
      "\n\tenclosingPassage:", ...dumpObject(enclosingPassage), enclosingChronicleURI,
      "\n\ttarget.meta:", ...dumpObject(targetMeta),
    ]);
  }
}

export function resolveChronicleURI (resolver: Resolver, resourceId: VRL) {
  return (!resourceId.isGhost()
          ? resourceId
          : resolver.bindObjectId([resourceId.getGhostPath().headHostRawId()], "Resource"))
      .getChronicleURI();
}

export function setCreatedObjectChronicle (mutableTransient: Transient) {
  const transientId = mutableTransient.get("id");
  const chronicleURI = determineNewObjectChronicle(mutableTransient, transientId);
  if (!chronicleURI) return;
  if (chronicleURI !== transientId.getChronicleURI()) {
    transientId.setChronicleURI(chronicleURI);
  }
}

export function setModifiedObjectChronicleAndUpdateOwneeObjectIdChronicles (
    bard: Bard, mutableTransient: Transient) {
  const transientId = mutableTransient.get("id");
  const chronicleURI = determineNewObjectChronicle(mutableTransient, transientId);
  const oldChronicleURI = transientId.getChronicleURI();
  if (chronicleURI !== oldChronicleURI) {
    mutableTransient.set("id", transientId.immutateWithChronicleURI(chronicleURI));
    bard.setState(_updateOwnlingChronicles(bard, mutableTransient, chronicleURI, oldChronicleURI));
  }
}

export function determineNewObjectChronicle (mutableTransient: Transient, transientId: VRL) {
  const authorityURI = mutableTransient.get("authorityURI")
      || mutableTransient.get("partitionAuthorityURI");
  if (transientId.isGhost()) {
    // Materializing or modifying ghost.
    if (authorityURI) {
      throw new Error(`Ghost objects cannot be chronicle roots; ${
          ""}while trying to set authorityURI <${authorityURI}> for ${transientId}`);
    }
    transientId.clearChronicleURI();
    return undefined;
  }
  let chronicleURI;
  const ownerId = mutableTransient.get("owner");
  if (authorityURI) {
    chronicleURI = naiveURI.createChronicleURI(authorityURI, transientId.rawId());
  } else if (ownerId) {
    chronicleURI = ownerId.getChronicleURI();
  } else {
    // Don't set chronicleURI: this might be a resource which part of
    // a TRANSACTED and has its owner subsequently set.
  }
  return chronicleURI;
}

function _updateOwnlingChronicles (bard: Bard, mutableTransient: Transient,
    newChronicleURI: string, oldChronicleURI: string) {
  return bard.getState().withMutations(mutableState => {
    const chroniclerBard = Object.create(bard);
    traverseMaterializedOwnlings(chroniclerBard, mutableTransient, entryId => {
      // skip ghosts: their chronicle is specified by their host.
      if (entryId.isGhost()
          // specifying "Resource" only traverses actives Resource's.
          || !chroniclerBard.tryGoToTransientOfRawId(entryId.rawId(), "Resource")
          || (chroniclerBard.objectId.getChronicleURI() !== oldChronicleURI)) return null;
      mutableState.setIn([chroniclerBard.objectTypeName, entryId.rawId(), "id"],
              entryId.immutateWithChronicleURI(newChronicleURI));
      return chroniclerBard.objectTransient;
    });
  });
}
