// @flow

import { ValoscriptInterface, ValoscriptPrimitiveKind } from "~/script";
import { toVAKON } from "~/script/VALSK";

import { beaumpify } from "~/tools";

import { denoteValOSBuiltinWithSignature } from "~/raem/VALK";

/* eslint-disable prefer-arrow-callback */

export default function injectSchemaTypeBindings (valos: Object) {
  Object.assign(valos, {
    beautify: beaumpify,
    toVAKON,
    Primitive: ValoscriptPrimitiveKind,
    Lens: null,
  });

  valos.Discourse = Object.assign(Object.create(ValoscriptInterface), {
    name: "Discourse",

    getContextDiscourse: denoteValOSBuiltinWithSignature(
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
}
