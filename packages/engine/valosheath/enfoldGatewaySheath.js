// @flow

import { vRef } from "~/raem/VRL";
import { denoteValOSCallable, denoteDeprecatedValOSCallable } from "~/raem/VALK";

import { valoscriptInterfacePrototype, ValoscriptPrimitiveKind } from "~/script";
import { toVAKONTag } from "~/script/VALSK";
import VALEK from "~/engine/VALEK";

import type { Discourse } from "~/sourcerer/api/types";

import * as tools from "~/tools";

/* eslint-disable prefer-arrow-callback */

export default function enfoldGatewaySheath (
    valos: Object, hostDescriptors, rootDiscourse: Discourse) {
  Object.assign(valos, {
    beautify: tools.dumpify,
    toVAKONTag,
    Primitive: ValoscriptPrimitiveKind,
    Lens: null,
    tools,
  });

  valos.describe = denoteValOSCallable(
`Returns a description of a valos fabric primitive symbol,
function or a resource.`,
  )(function describe (primitive) {
    if (primitive == null) return undefined;
    const hostDescriptor = hostDescriptors.get(primitive);
    if (hostDescriptor) return hostDescriptor;
    if (primitive._valkDescription) {
      return {
        valos: true, vcall: true,
        type: "Function", // TODO(iridian, 2020-07): infer the actual type from signature
        description: primitive._valkDescription,
      };
    }
    return undefined;
  });

  valos.vrefer = denoteValOSCallable(
`Returns a valos resource locator built from the given *authorityURI*,
*chronicleVRID* and *resourceVRID* parts.`
  )(function vrefer (authorityURI_, chronicleVRID_, resourceVRID_) {
    let resourceVRID, chronicleURI;
    if (resourceVRID_ !== undefined) {
      resourceVRID = resourceVRID_;
      chronicleURI = `${authorityURI_}?id=${chronicleVRID_}`;
    } else if (chronicleVRID_ !== undefined) {
      resourceVRID = chronicleVRID_;
      chronicleURI = authorityURI_;
    } else {
      ([chronicleURI, resourceVRID] = authorityURI_.split("#"));
      if (resourceVRID === undefined) {
        throw new Error("vref fragment resource VRID part missing");
      }
    }
    resourceVRID = resourceVRID.split(";")[0];
    return this.__callerValker__.run(null, VALEK.fromObject(resourceVRID).nullable())
        || vRef(resourceVRID, undefined, undefined, chronicleURI)
            .setAbsent();
  });

  valos.Discourse = Object.assign(Object.create(valoscriptInterfacePrototype), {
    name: "Discourse",

    getContextDiscourse: denoteDeprecatedValOSCallable([
`Returns the discourse of the current execution context.`,
`If the execution context is not transactional the discourse is the
top-level discourse between engine and the upstream false prophet.
Otherwise the discourse is a transaction-specific discourse which is
valid only until the transaction is finalized. A transaction discourse
has its state isolated both from other transactions as well as from
events coming downstream until it is committed.`,
    ], [
      "DEPRECATED", "valos.getFrame",
    ])(function getContextDiscourse () {
      return this && this.__callerValker__;
    }),
  });

  valos.getRootDiscourse = denoteValOSCallable([
`Returns the root discourse of this global execution context`,
`This discourse is non-transactional and its lifetime is tied to
the global execution context.`,
  ])(function getRootDiscourse () { return rootDiscourse; });

  valos.getFabricator = denoteValOSCallable(
`Returns the current fabricator.`
  )(function getFrame () {
    return this && this.__callerValker__;
  });

  valos.getTransactor = denoteValOSCallable(
`Returns the current transactor.`
  )(function getTransactor () {
    return this && this.__callerValker__ && this.__callerValker__.getTransactor();
  });
}
