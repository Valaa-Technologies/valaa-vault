// @flow

import { tryHostRef } from "~/raem/VALK/hostReference";
import Valker from "~/raem";

import engineSteppers from "~/engine/VALEK/engineSteppers";

// undefined: use default behaviour ie. walk all arguments
// null: completely disabled
// other: call corresponding function callback, if it returns performDefaultGet then use default,
//        otherwise return the value directly.
export default Object.assign(Object.create(engineSteppers), {
  kuerySubscription: null,
  // "§nonlive": engineSteppers,
  "§.": _liveAccess,
  "§new": _throwMutationLiveKueryError,
  "§while": _throwUnimplementedLiveKueryError,
  "§$$<-": _throwMutationLiveKueryError,
  "§..<-": _throwMutationLiveKueryError,
  "§$$<->": _throwMutationLiveKueryError,
  "§..<->": _throwMutationLiveKueryError,
  "§delete$$": _throwMutationLiveKueryError,
  "§delete..": _throwMutationLiveKueryError,
});

function _throwUnimplementedLiveKueryError (subscription, head, scope, kueryVAKON) {
  throw new Error(`Live kuery not implemented yet for complex step: ${
      JSON.stringify(kueryVAKON)}`);
}

function _throwMutationLiveKueryError (subscription, head, scope, kueryVAKON) {
  throw new Error(`Cannot make a kuery with side-effects live. Offending step: ${
      JSON.stringify(kueryVAKON)}`);
}

function _liveAccess (valker: Valker, head: any, scope: any,
    accessStep: any[] /* , nonFinalStep: ?boolean */) {
  const hostRef = tryHostRef(head);
  if (hostRef) {
    const kuerySubscription = this.kuerySubscription;
    const vrapper = kuerySubscription._emitter.getEngine()
        .getVrapper(hostRef, kuerySubscription._liveOptions);
    // TODO(iridian, 2019-04): Replace the 'true' with false if this is
    // a leaf property access. This will mark this hook as
    // non-structural, preventing unnecessary rehooking of the whole
    // subscription when this field updates.
    kuerySubscription.attachKueryFieldHook(vrapper, accessStep[1], true);
  }
  return engineSteppers["§."].apply(this, arguments); // eslint-disable-line prefer-rest-params
}
