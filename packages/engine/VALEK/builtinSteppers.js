// @flow

import { Valker, BuiltinStep } from "~/raem/VALK";
import { HostRef, UnpackedHostValue, tryUnpackedHostValue } from "~/raem/VALK/hostReference";

import { tryLiteral, /* tryFullLiteral,*/ tryUnpackLiteral }
    from "~/raem/VALK/builtinSteppers";

import valaaScriptBuiltinSteppers from "~/script/VALSK/builtinSteppers";

import Vrapper from "~/engine/Vrapper";
import getImplicitCallable from "~/engine/Vrapper/getImplicitCallable";

// import { createNativeIdentifier } from "~/script/denormalized/nativeIdentifier";

import { wrapError, dumpObject } from "~/tools";

export default Object.freeze({
  ...valaaScriptBuiltinSteppers,
  "§callableof": callableOf,
  "§method": toMethod,
});

function callableOf (valker: Valker, head: any, scope: ?Object,
    [, callee, toRoleName]: BuiltinStep) {
  let eCandidate;
  try {
    eCandidate = tryUnpackLiteral(valker, head, callee, scope);
    if (typeof eCandidate === "function") return eCandidate;
    const roleName = tryUnpackLiteral(valker, head, toRoleName, scope);
    const vrapper = tryUnpackedHostValue(eCandidate);
    if (vrapper && (vrapper.tryTypeName() === "Media")) {
      return getImplicitCallable(vrapper, roleName, { transaction: valker });
    }
    throw new Error(`Could not implicitly convert callee to a function for ${roleName}`);
  } catch (error) {
    throw wrapError(error, `During ${valker.debugId()}\n .callableof, with:`,
        "\n\thead:", ...dumpObject(head),
        "\n\tcallee candidate:", ...dumpObject(eCandidate),
    );
  }
}

function toMethod (valker: Valker, head: any, scope: ?Object, [, callableName]: any,
    hostHead?: Object) {
  if (valker.pure) {
    // TODO(iridian): kuery protection is disabled as it's not semantically pure (pun intended).
    // It was intended to denote kueries which have no side effects and could thus be called
    // freely. This relevant for kueries performing UI rendering, for example. However the theory
    // of abstraction piercing methods and purity being congruent did not hold for a day.
    // This system should be re-thought: idempotency and abstraction piercing are separate concepts.
    // throw new Error("'`getHostCallable' VALK abstraction piercing found in pure kuery");
  }
  // FIXME(iridian) So messy... the big idea here was to treat the abstraction piercing host methods
  // as first class objects, so that they can be given to §call/§apply. But the annoying thing with
  // that is that there needs to be a way to forward the valker as a transaction to the Vrapper
  // methods so that they can keep accessing and modifying the transactional state. So
  // getVALKMethod below encapsulates the valker, transient and scope etc. in a closure and then
  // constructs a native function which uses them, so that the native function can pretend to be
  // a normal javascript function.
  // So we get to keep some of the expressive power at the cost of both complexity and performance.
  // Luckily with ValaaScript no external interface exposes these details anymore so they can
  // eventually be simplified and made performant.
  const transient = valker.trySingularTransient(head);
  const actualHostHead = hostHead || valker.unpack(transient) || head;
  if (!actualHostHead || !actualHostHead.getVALKMethod) {
    throw wrapError(new Error("Can't find host object or it is missing member .getVALKMethod"),
        `During ${valker.debugId()}\n .toMethod(${callableName}), with:`,
        "\n\thead:", ...dumpObject(head),
        "\n\thostValue:", ...dumpObject(actualHostHead));
  }
  const eMethodName = (typeof callableName !== "object") ? callableName
      : tryLiteral(valker, head, callableName, scope);
  return actualHostHead.getVALKMethod(eMethodName, valker, transient, scope);
}
