// @flow

import { vRef } from "~/raem/VRL";
import { denoteValOSCallable, denoteDeprecatedValOSCallable } from "~/raem/VALK";

import { valoscriptInterfacePrototype, ValoscriptPrimitiveKind } from "~/script";
import { toVAKONTag } from "~/script/VALSK";
import VALEK from "~/engine/VALEK";
import Vrapper from "~/engine/Vrapper";

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

  valos.refer = denoteValOSCallable([
`Returns a valos resource referred to by the given *resourcePart*
and the optional *chroniclePart* and *authorityURL* parts.`,
`This call has *locating* and *non-locating* variants depending on
whether the parts contain the chronicle URL information.`,
null,
`If only a valos resource id string is given (ie. no '#'-separator) as
the *resourcePart* then the reference doesn't contain a chronicle URL
and is non-locating. If the resource is not already locally known then
a non-locating resource cannot activated and is only useful for
identity operations.
If the resource is locally known it is returned and is possibly already
active. Even if the resource is absent it is activateable because the
known chronicle URI allows the chronicle to be sourcered.`,
null,
`All other variants contain the chronicle URL and return either a fully
active or absent but locateable resource.`,
null,
`If all three parts are provided then *resourcePart* must be the vrid
of the referred resource, *chroniclePart* must be the vgrid of the
chronicle root resource and *authorityURL* must be the chronicle
authority URL without the chronicle infix.`,
null,
`If no *authorityURL* is given then *chroniclePart* must be a
fully formed chronicle URL (ie. contains the authority URL, the
chronicle infix and the chronicle vgrid).`,
null,
`If no *chroniclePart* is given then *resourcePart* must be a full
resource URL (ie. contains the chronicle URL as defined above and the
'#' fragment separator followed by the resource vrid).`
  ])(function refer (resourcePart, chroniclePart, authorityURI) {
    let resourceVRID = resourcePart, chronicleURI;
    if (chroniclePart !== undefined) {
      chronicleURI = (authorityURI !== undefined)
          ? `${authorityURI}?id=${chroniclePart}`
          : chroniclePart;
    } else if (resourcePart.indexOf("#") !== -1) {
      ([chronicleURI, resourceVRID] = resourcePart.split("#"));
    }
    resourceVRID = resourceVRID.split(";")[0];
    let ret = this.__callerValker__.run(null, VALEK.fromObject(resourceVRID).nullable());
    if (!ret && chronicleURI) {
      ret = vRef(resourceVRID, undefined, undefined, chronicleURI).setAbsent();
    }
    return ret || null;
  });

  valos.fickleRefer = denoteValOSCallable([
`Returns a valos resource referred to by the given *fickleId*`,
`The fickle id must have been obtained during this execution session by
a previous call to *resource*.$V.getFickleId(). Otherwise this call
returns *undefined*.`,
  ])(function fickleRefer (fickleId) {
    return Vrapper.getFickleResource(fickleId);
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
