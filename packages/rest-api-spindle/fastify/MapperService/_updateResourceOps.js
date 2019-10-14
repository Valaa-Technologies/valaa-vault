// @flow

import VALEK from "~/engine/VALEK";
import Vrapper from "~/engine/Vrapper";

export function _updateResource (mapper, vResource, patch,
    { discourse, scope, toPatchTarget }) {
  if (!vResource) {
    if (!toPatchTarget) return undefined;
    throw new Error("Target resource missing when trying to PATCH fields");
  }
  const vTarget = !toPatchTarget ? vResource
      : vResource.get(toPatchTarget, { discourse, scope });
  const options = { discourse, scope };
  _recursiveUpdate(vTarget, patch, options);
  return vTarget;
}

function _recursiveUpdate (vScope, patch, options) {
  Object.entries(patch).forEach(([propertyName, value]) => {
    if ((value === undefined) || (propertyName === "$V")) return;
    if (Array.isArray(value)) throw new Error("Batch mapping PATCH not implemented yet");
    const currentValue = vScope.propertyValue(propertyName, Object.create(options));
    if (currentValue instanceof Vrapper) {
      if ((value == null) || (typeof value !== "object")) {
        throw new Error(`Cannot overwrite a structured property '${propertyName
            }' with a non-object value of type '${typeof value}'`);
      }
      _recursiveUpdate(currentValue, value, options);
    } else {
      const newValue = ((value != null) && (typeof value === "object")
              && (currentValue != null) && (typeof currentValue === "object"))
          ? Object.assign(currentValue, value)
          : value;
      vScope.alterProperty(propertyName, VALEK.fromValue(newValue), Object.create(options));
    }
  });
}
