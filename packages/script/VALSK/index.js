// @flow

import { Kuery } from "~/raem/VALK";

import type { VRL } from "~/raem/VRL";

import { literal as _literal } from "~/script/schema/Literal";
import { identifier } from "~/script/schema/Identifier";

import ValoscriptKuery, { ScopeAccessesTag, ScopeAccessKeysTag } from "./ValoscriptKuery";


export default new ValoscriptKuery();

export {
  Valker,
  run,
  dumpScope,
  dumpKuery,
  dumpObject,
  isValOSFunction,
  toVAKON,
} from "~/raem/VALK";

export {
  Kuery,
  ScopeAccessesTag,
  ScopeAccessKeysTag,
  ValoscriptKuery,
};
export {
  default as valoscriptSteppers,
} from "./valoscriptSteppers";

// TODO(iridian): literal/pointer could be streamlined into actual Kuery objects, like
// VALEK.expandToLiteral/Identifier, which would return Kuery's that evaluate to expanded
// Literal/Identifier objects. The current literal/pointer are a bit of mongrel functions which are
// really only useful with the mutations.

/**
 * Returns an expanded valoscript Literal with given value.
 *
 * An expanded valoscript Literal behaves like @valos/script/schema/Literal.literal except that it
 * can only be used as part of an mutation (which recurses and evaluates any nested Kuery's,
 * \see universalizeCommandData).
 *
 * @export
 * @param {(Kuery | Object | Array<any> | boolean | string | number |)} [value=null]
 * @returns
 */
export function literal (value: Kuery | Object | Array<any> | boolean | string | number | null) {
  if (!(value instanceof Kuery)) return _literal(value);
  return { typeName: "Literal", value };
}

/**
 * Returns an expanded valoscript Identifier with given target.
 *
 * Like @valos/script/schema/Identifier.identifier, but can only be used as part of a mutation.
 * \see literal for more details.
 *
 * @export
 * @param {(Kuery | Vrapper)} target
 * @returns
 */
export function pointer (target: Kuery | VRL) {
  if (!(target instanceof Kuery)) return identifier(target);
  return { typeName: "Identifier", reference: target };
}
