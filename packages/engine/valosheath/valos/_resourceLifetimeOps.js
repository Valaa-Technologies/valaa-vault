// @flow

import { getHostRef } from "~/raem/VALK/hostReference";

import Discourse from "~/sourcerer";

import { OwnerDefaultCouplingTag } from "~/engine/valosheath/valos/enfoldSchemaSheath";

export function newResource (discourse: Discourse, scope: ?Object, initialState: ?Object) {
  const actualInitialState = _prepareInitialState(this, scope, initialState, "new");
  const resource = discourse._follower.create(this.name, actualInitialState, { discourse });
  return resource;
}

export function instantiateResource (discourse: Discourse, scope: ?Object,
    resource: any, initialState: ?Object) {
  return resource.instantiate(
      _prepareInitialState(this, scope, initialState, "instantiate"), { discourse });
}

export function duplicateResource (discourse: Discourse, scope: ?Object,
    resource: any, initialState: ?Object) {
  return resource.duplicate(
      _prepareInitialState(this, scope, initialState, false), { discourse });
}

function _prepareInitialState (valospaceType: Object, scope: ?Object, initialState_: ?Object,
    requireOwnerOperation: ?string) {
  let initialState = initialState_;
  if ((initialState != null) && (typeof initialState !== "object")) {
    throw new Error(`new.initialState must by undefined or an object, got ${typeof initialState}`);
  }

  // TODO(iridian): Check for non-allowed fields.
  const initialOwner = initialState && (initialState.owner !== undefined
      ? initialState.owner : _tryOwnerAlias(valospaceType, initialState));
  if (!initialOwner) {
    if (initialOwner === null) return initialState;
    if (requireOwnerOperation) {
      // throw new Error(`${requireOwnerOperation} initialState.owner required`);
      console.error(`DEPRECATED behaviour: ${
          requireOwnerOperation} ${valospaceType.name} initialState.owner required`);
      if (scope && (scope.self != null) && scope.self.this) {
        if (!initialState) initialState = {};
        initialState.owner = scope.self.this.getId()
            .coupleWith(valospaceType[OwnerDefaultCouplingTag]);
      }
    }
  } else if (typeof initialOwner !== "object") {
    throw new Error(`${requireOwnerOperation || "duplicate"
        } initialState.owner must be a Resource, got '${typeof initialOwner}'`);
  } else if ((initialState.owner !== undefined) && valospaceType[OwnerDefaultCouplingTag]) {
    initialState.owner =
        getHostRef(initialState.owner, `${requireOwnerOperation || "duplicate"} initialState.owner`)
        .coupleWith(valospaceType[OwnerDefaultCouplingTag]);
  }
  return initialState;
}

function _tryOwnerAlias (valospaceType: Object, initialState: Object) {
  return (valospaceType.name === "Relation") && initialState.source;
}
