// @flow

import { vRef } from "~/raem/VRL";
import { denoteDeprecatedValOSBuiltin, denoteValOSBuiltinWithSignature } from "~/raem/VALK";


import { valoscriptInterfacePrototype, ValoscriptPrimitiveKind } from "~/script";
import { toVAKON } from "~/script/VALSK";
import VALEK from "~/engine/VALEK";

import type { Discourse } from "~/sourcerer/api/types";

import * as tools from "~/tools";

/* eslint-disable prefer-arrow-callback */

export default function enfoldGatewaySheath (valos: Object, rootDiscourse: Discourse) {
  Object.assign(valos, {
    beautify: tools.dumpify,
    toVAKON,
    Primitive: ValoscriptPrimitiveKind,
    Lens: null,
    tools,
  });

  valos.vrefer = denoteValOSBuiltinWithSignature(
      `returns a resource referred to by the given vref parameters.`
  )(function vrefer (authorityURI_, chronicleVRId_, resourceVRId_) {
    let resourceVRId, chronicleURI;
    if (resourceVRId_ !== undefined) {
      resourceVRId = resourceVRId_;
      chronicleURI = `${authorityURI_}?id=${chronicleVRId_}`;
    } else if (chronicleVRId_ !== undefined) {
      resourceVRId = chronicleVRId_;
      chronicleURI = authorityURI_;
    } else {
      ([chronicleURI, resourceVRId] = authorityURI_.split("#"));
      if (resourceVRId === undefined) {
        throw new Error("vref fragment resource vrid part missing");
      }
    }
    resourceVRId = resourceVRId.split(";")[0];
    let ret = this.__callerValker__.run(null, VALEK.fromObject(resourceVRId).nullable());
    if (!ret) {
      ret = vRef(resourceVRId, undefined, undefined, chronicleURI);
      ret.setInactive();
    }
    return ret;
  });

  valos.Discourse = Object.assign(Object.create(valoscriptInterfacePrototype), {
    name: "Discourse",

    getContextDiscourse: denoteDeprecatedValOSBuiltin(
        "valos.getFrame",
        `returns the discourse of the current execution context. If the
        execution context is not transactional the discourse is the
        top-level discourse between engine and the upstream false
        prophet. Otherwise the discourse is a transaction-specific
        discourse which is valid only until the transaction is
        finalized. A transaction discourse has its state isolated both
        from other transactions as well as from events coming
        downstream until it is committed.`
    )(function getContextDiscourse () {
      return this && this.__callerValker__;
    }),
  });

  valos.getRootDiscourse = denoteValOSBuiltinWithSignature(
      `returns the root discourse of this global execution context.
      This discourse is non-transactional and its lifetime is tied to
      the global execution context.`
  )(function getRootDiscourse () { return rootDiscourse; });

  valos.getFabricator = denoteValOSBuiltinWithSignature(
      `returns the current fabricator.`
  )(function getFrame () {
    return this && this.__callerValker__;
  });

  valos.getTransactor = denoteValOSBuiltinWithSignature(
      `returns the current transactor.`
  )(function getTransactor () {
    return this && this.__callerValker__ && this.__callerValker__.getTransactor();
  });
}
