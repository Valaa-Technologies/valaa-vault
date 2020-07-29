// @flow

import Vrapper from "~/engine/Vrapper";

export function _updateResource (router, vResource, patch,
    { discourse, scope, toPatchTarget, patchValosFields }) {
  if (!vResource) {
    if (!toPatchTarget) return undefined;
    throw new Error("Target resource missing when trying to PATCH fields");
  }
  const vTarget = !toPatchTarget ? vResource
      : vResource.step(toPatchTarget, { discourse, scope });
  const options = { discourse, scope };
  _recursiveUpdate(vTarget, patch, options,
      (patchValosFields === false) ? null : undefined);
  return vTarget;
}

function _recursiveUpdate (vScope, patch, options, isValOSFields) {
  Object.entries(patch).forEach(([propertyName, value]) => {
    if (value === undefined) return;
    if (propertyName === "$V") {
      if (isValOSFields === null) return; // explicitly disabled
      _recursiveUpdate(vScope, value, options, true);
    } else if (Array.isArray(value)) {
      throw new Error("Batch mapping PATCH not implemented yet");
    } else {
      const currentValue = !isValOSFields
          ? vScope.propertyValue(propertyName, Object.create(options))
          : vScope.step(propertyName, Object.create(options));
      if (currentValue instanceof Vrapper) {
        if ((value == null) || (typeof value !== "object")) {
          throw new Error(`Cannot overwrite a structural property '${propertyName
              }' with a non-object value of type '${typeof value}'`);
        }
        _recursiveUpdate(currentValue, value, options, isValOSFields !== null ? false : null);
      } else {
        const newValue = ((value != null) && (typeof value === "object")
                && (currentValue != null) && (typeof currentValue === "object"))
            ? Object.assign(currentValue, value)
            : value;
        if (!isValOSFields) {
          vScope.updateProperty(propertyName, newValue, options);
        } else {
          vScope.setField(propertyName, newValue, Object.create(options));
        }
      }
    }
  });
}
