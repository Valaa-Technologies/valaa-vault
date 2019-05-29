import { arrayFromAny } from "~/tools/sequenceFromAny";

// TODO(iridian, 2019-05): Obsolete in favor of patchWith

export default function mergeDeep (target: any, sources: any[]) {
  return mergeDeepWith(target, sources);
}

export function mergeDeepWith (target: any, sources: any[], customizer?: Function) {
  let intermediate = target;
  for (const source of arrayFromAny(sources)) intermediate = _mergeRecurse(intermediate, source);
  return intermediate;
  function _mergeRecurse (target_: any, source_: any, key?: string, targetObject?: Object,
      sourceObject?: Object) {
    const result = customizer && customizer(target_, source_, key, targetObject, sourceObject);
    if (typeof result !== "undefined") return result;
    if (typeof source_ === "undefined") return target_;
    if ((typeof source_ !== "object") || (source_ === null)) return source_;
    const actualTarget = (typeof target_ === "object") && (target_ !== null)
        ? target_
        : {};
    for (const [sourceKey, value] of Object.entries(source_)) {
      actualTarget[sourceKey] =
          _mergeRecurse(actualTarget[sourceKey], value, sourceKey, targetObject, sourceObject);
    }
    return actualTarget;
  }
}
