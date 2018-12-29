/**
 * Returns an object layed arranges by values of given fieldNameToLayoutBy.
 * For example, with "name" the output would be like:
 * {
 *   Entity: {
 *     Jack: [
 *       { id: "1", name: "Jack" },
 *       { id: "2", name: "Jack" },
 *     ]
 *   }
 * }
 *
 * @export
 * @param {any} state
 * @param {any} fieldNameToLayoutBy
 * @param {any} fallbackGroupKey    group key to use for objects missing fieldNameToLayoutBy.
 *                                  If undefined, such resources will be discarded from the listing
 *                                  instead.
 * @returns
 */
export default function layoutByObjectField (state, fieldNameToLayoutBy, fallbackGroupKey = "") {
  const stateJs = state.toJS();
  const ret = {};
  Object.keys(stateJs)
      .map(typeName => listResourcesByField(typeName, stateJs[typeName]))
      .filter(notNull => notNull)
      .forEach(([key, value]) => { ret[key] = value; });
  return ret;
  function listResourcesByField (typeName, resources) {
    const innerRet = Object.keys(resources).reduce((prev, currKey) => {
      const curr = resources[currKey];
      const groupKey = curr[fieldNameToLayoutBy] || fallbackGroupKey;
      if (typeof groupKey === "undefined") return prev;
      if (!prev) return { [groupKey]: { [currKey]: curr } };
      prev[groupKey] = (prev[groupKey] || {});
      prev[groupKey][currKey] = curr;
      return prev;
    }, undefined);
    return innerRet ? [typeName, innerRet] : undefined;
  }
}
