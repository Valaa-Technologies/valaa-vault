import { Iterable } from "immutable";
import { GraphQLList, isLeafType, getNullableType } from "graphql/type";

import { tryObjectTransient } from "~/raem/state/getObjectTransient";
import { getTransientTypeName } from "~/raem/state/Transient";

import wrapError from "~/tools/wrapError";
import dumpify from "~/tools/dumpify";

/**
 * collectFields - Walks all fields of the given resource, sends them to reviver and
 * collects the returned values in corresponding fields of the returned collector object.
 *
 * @param  {type} schema        description
 * @param  {type} state         description
 * @param  {type} resourceId       description
 * @param  {type} typeName description
 * @param  {(value, type, fieldIntro, ownerValue, ownerType) => value} reviver description
 * @returns {type}               description
 */
export default function collectFields (schema, state, resourceId, typeName, reviver) {
  // TODO(iridian): Refactor collectFields to use Resolver.
  const start = tryObjectTransient(state, resourceId, typeName);
  if (!start) return null;
  const startType = schema.getType(getTransientTypeName(start, schema));
  if (!startType) {
    console.error(`ERROR: unrecognized schema type '${typeName}'`);
    return undefined;
  }
  return walkValue(start, startType);

  function walkValue (object, objectType, ownerFieldIntro, owner, ownerType) {
    // console.log("walkValue",
    //    dumpify(object, { sliceAt: 200, sliceSuffix: "...}" }), objectType.name);
    if (!object) return object;
    const nullableType = getNullableType(objectType);
    if (isLeafType(nullableType)) return object;

    if (nullableType instanceof GraphQLList) {
      const sequenceAccumulator = [];
      if (!Iterable.isOrdered(object) || Iterable.isKeyed(object)) {
        console.warn(`Inconsistent data with schema, coercing non-list to single-entry list; got ${
            dumpify(object, { sliceAt: 100 })}, expected list of ${nullableType.ofType.name
            } when collecting field ${ownerType.name} ${owner.get("id")}.${
            ownerFieldIntro.name}`);
        sequenceAccumulator.push(object);
      } else {
        object.forEach(entry => {
          const { value, type } = tryAsObject(entry, nullableType.ofType, owner);
          const result = (typeof value === "undefined") ? undefined
              : reviver(value, type, ownerFieldIntro, owner, ownerType, walkValue, entry);
          if (typeof result !== "undefined") sequenceAccumulator.push(result);
        });
      }
      return sequenceAccumulator;
    }

    const objectAccumulator = {};
    const objectFields = nullableType.getFields();
    object.forEach((entry, key) => {
      if (typeof entry !== "undefined") {
        const fieldIntro = objectFields[key];
        if (fieldIntro) {
          try {
            const { value, type } = (fieldIntro.type instanceof GraphQLList)
                ? { value: entry, type: fieldIntro.type }
                : tryAsObject(entry, getNullableType(fieldIntro.type), object,
                    fieldIntro);
            // console.log("walked field", fieldIntro.name, "of type", type && type.name, ":",
            //    dumpify(value));
            const result = (typeof value === "undefined") ? undefined
                : reviver(value, type, fieldIntro, object, nullableType, walkValue, entry);
            if (typeof result !== "undefined") objectAccumulator[fieldIntro.name] = result;
          } catch (error) {
            throw wrapError(error, `During walkValue.object.forEach(${key}->`, entry, ")");
          }
        }
      }
    });
    return objectAccumulator;

    function tryAsObject (value, type, innerOwner, field) {
      if (isLeafType(type) || (value === null)) { return { value, type }; }
      if (!value) {
        console.warn(`Falsy non-null encountered for id: expected null or valid ${type
            } id; coercing to null, when collecting ${
            innerOwner ? innerOwner.get("id") : "(unknown)"}:${
            field ? nullableType.name : ownerType.name || "(unknown)"}.${
            (field || ownerFieldIntro || { name: "(unknown)" }).name}:${type.name}', got`,
            value);
        return { value: null, type };
      }
      const innerObject = tryObjectTransient(state, value, type.name);
      if (innerObject) {
        return {
          value: innerObject, type: schema.getType(getTransientTypeName(innerObject, schema)),
        };
      }
      console.error(`Cannot find ${value}:${type.name}: ${innerObject
          } from store, coercing to undefined, while collecting ${
          innerOwner ? innerOwner.get("id") : "(unknown)"}:${
          field ? objectType.name : ownerType.name || "(unknown)"}.${
          (field || ownerFieldIntro || { name: "(unknown)" }).name}`);
      return { value: undefined, type };
    }
  }
}
