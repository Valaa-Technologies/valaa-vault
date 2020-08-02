// @flow

import { getHostRef } from "~/raem/VALK/hostReference";

import Discourse from "~/sourcerer";

import { OwnerDefaultCouplingTag } from "~/engine/valosheath/enfoldSchemaSheath";

export function newResource (discourse: Discourse, scope: ?Object, initialState: ?Object) {
  const actualInitialState = _prepareInitialState(this, scope, initialState, "new");
  const resource = discourse.getFollower().create(this.name, actualInitialState, { discourse });
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

function _prepareInitialState (valospaceType: Object, scope: ?Object, initialState: ?Object,
    requireOwnerOperation: ?string) {
  let initialOwner;
  if (initialState != null) {
    if (typeof initialState !== "object") {
      throw new Error(`"new ${valospaceType.name
          }" must be given an options object or null as the single argument, got ${
          typeof initialState}`);
    } else {
      initialOwner = (initialState.owner !== undefined)
          ? initialState.owner
          : _tryOwnerAlias(valospaceType, initialState);
      if (initialState.partitionAuthorityURI) {
        console.debug("DEPRECATED: partitionAuthorityURI in favor of authorityURI");
        initialState.authorityURI = initialState.partitionAuthorityURI;
        delete initialState.partitionAuthorityURI;
      }
    }
  }
  // TODO(iridian): Check for non-allowed fields.
  if (!initialOwner) {
    if (requireOwnerOperation && (initialOwner === undefined)
        && !(initialState && initialState.authorityURI)) {
      throw new Error(`"${requireOwnerOperation} ${valospaceType.name
          }" options must contain 'owner' or 'authorityURI' (for chronicle roots)`);
    }
  } else if (typeof initialOwner !== "object") {
    throw new Error(`"${requireOwnerOperation || "duplicate"
        }${valospaceType.name}" options owner must be a Resource, got '${typeof initialOwner}'`);
  } else if ((initialState.owner !== undefined) && valospaceType[OwnerDefaultCouplingTag]) {
    initialState.owner =
        getHostRef(initialState.owner, `${requireOwnerOperation || "duplicate"} initialState.owner`)
        .coupleWith(valospaceType[OwnerDefaultCouplingTag]);
  }
  return initialState;
}

function _tryOwnerAlias (valospaceType: Object, initialState: Object) {
  return (valospaceType.name === "Relation") ? initialState.source : undefined;
}
