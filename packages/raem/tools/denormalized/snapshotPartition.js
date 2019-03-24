/*
import { Iterable } from "immutable";
import { GraphQLList, isLeafType, getNamedType } from "graphql/type";

import { tryRawIdFrom } from "~/raem/VRL";
import { getTransientTypeName } from "~/raem/state/Transient";
import collectFields from "~/raem/tools/denormalized/collectFields";
import isResourceType from "~/raem/tools/graphql/isResourceType";
import { tryObjectTransient } from "~/raem/state/getObjectTransient";

import { createId, wrapError } from "~/tools";
*/

/**
 * snapshotPartition - traverses all descendants and dependents of the given partition and then
 * serializes them via given onCreated and onModified callbacks.
 * Traversal rules:
 * 1. owners are always traversed before ownees
 * 2. only the owner link and leaf properties are given in onCreated calls
 * 3. order of onCreated calls is the order where the resources appear in their owners
 * 4. peer links and only them are given in onModified calls
 *
 * @param  {async function(id, typeName, initialStateCallback)} onCreated
 *    Called for each traversed resource the first time the resource is encountered.
 *    Other parameters are such that they can directly be given to 'created' command, but
 *    initialState must be retrieved by calling initialStateCallback(); this call will trigger the
 *    subsequent traversal of all connections leading out from the resource.
 * @param  {async function(id, typeName, modifies)}            onModified description
 * @returns {type}                                                            description
 */
export default async function snapshotPartition (/* { partitionId, state, schema, onCreated,
  onModified,
} */) {
  // TODO(iridian): Refactor snapshotPartition to use Resolver
  throw new Error("snapshotPartition has rotted.");
  /*
  const walkedIds = new Set();
  let defers = { resources: [], datas: [], modifies: [] };
  const partition = tryObjectTransient(state, partitionId, "Partition", true);
  try {
    walkResourceProcessingOwnersFirst(partition, (object) =>
      collectFields(schema, state, object.get("id").rawId(),
          getTransientTypeName(object, schema),
          fieldReviver));
    processDefers();
    return;
  } catch (error) {
    throw wrapError(error, `During snapshotPartition(${partitionId}:${
        partition && getTransientTypeName(partition, schema)})`);
  }

  function walkResourceProcessingOwnersFirst (resource, walkValue, field, parent, parentType) {
    const id = resource.get("id").rawId();
    if (!walkedIds.has(id)) {
      walkedIds.add(id);
      const owner = resource.get("owner");
      if (owner) {
        walkResourceProcessingOwnersFirst(tryObjectTransient(state, owner, "Resource", true),
            walkValue);
      }
      const typeName = getTransientTypeName(resource, schema);
      defers.resources.push(() => {
        let initialData;
        try {
          return onCreated(id, typeName, () =>
              walkValue(resource, schema.getType(typeName), field, parent, parentType));
        } catch (error) {
          throw wrapError(error, `During snapshotPartition.onCreated(${id}:${typeName
              }), initialData:`, initialData);
        }
      });
    }
  }

  function fieldReviver (value, type, field, parent, parentType, walkValue, fieldEntry) {
    try {
      // console.log(`fieldReviver ${dumpify(parent, { sliceAt: 40, sliceSuffix: "...}" })}:${
      //     parentType.name}.${field.name}`, `${
      //     dumpify(value, { sliceAt: 40, sliceSuffix: "...}" })}:${type.name}`);
      if ((field.name === "id") || (field.name === "typeName")) return undefined;
      if (!value) return value;
      const namedType = getNamedType(type);
      if (isLeafType(namedType)) return walkValue(value, namedType, field, parent, parentType);

      const parentIsResource = isResourceType(parentType);
      // revived value is here either an array of objects or an object. Handle array.
      if (type instanceof GraphQLList) {
        const object = walkValue(value, type, field, parent, parentType);
        if (!parentIsResource) return object;
        const idList = value.toJS();
        if (idList.length) {
          addDeferredSet(getTransientTypeName(parent, schema), parent.get("id").rawId(), field.name,
              idList);
        }
        // Irrespective of whether the array has owned or non-owned objects they'll be added later.
        return [];
      }

      // TODO(iridian): Inline Data code (not denormalized). The whole concept of inline data is
      // problematic: doesn't offer anything but readability. And that's what tools are for.
      if (typeof value.get !== "function") return value;
      const valueType = getTransientTypeName(value, schema) || getNamedType(field.type).name;
      // FIXME(iridian): createId is not deterministic at the moment.
      const valueId = tryRawIdFrom(value.get("id")) || createId({
        typeName: valueType, initialState: value.toJS(), isImmutable: true,
      });

      if (!walkedIds.has(valueId)) {
        if (isResourceType(namedType)) {
          walkResourceProcessingOwnersFirst(value, walkValue, field, parent, parentType);
        } else {
          // Always immediately walk non-Resource objects to reach (shared) Resource's behind them,
          // but defer sending them.
          walkedIds.add(valueId);
          const initialState = walkValue(value, type, field, parent, parentType);
          defers.datas.push(() => onCreated(valueId, valueType, () => initialState));
        }
      }
      if (!parentIsResource) return valueId;
      // Object is contained in a Resource. Place deferred sets for references not owned by this
      // field and if we're not processing an entry in an array (field.type !== type).
      if (!(field.coupling && field.coupling.isOwner)
          && (!(field.type instanceof GraphQLList) || (type instanceof GraphQLList))) {
        addDeferredSet(getTransientTypeName(parent, schema), parent.get("id").rawId(), field.name,
            Iterable.isIterable(fieldEntry) ? fieldEntry.toJS() : fieldEntry);
      }
      return null;
    } catch (error) {
      throw wrapError(error, `During snapshotPartition.fieldReviver(${value.get("id")}:${
          parentType.name}.${field.name}):`, value);
    }
  }

  function addDeferredSet (typeName, id, fieldName, value) {
    const byType = defers.modifies[typeName] || (defers.modifies[typeName] = {});
    const byId = byType[id] || (byType[id] = {});
    (byId.sets || (byId.sets = {}))[fieldName] = value;
  }

  function processDefers () {
    const defersQueue = [];
    function shiftDefersToQueue () {
      if (!defers.resources.length && !defers.datas.length
          && !Object.keys(defers.modifies).length) return;
      defersQueue.push(defers);
      defers = { resources: [], datas: [], modifies: [] };
    }
    shiftDefersToQueue();
    while (defersQueue.length) {
      const currentPass = defersQueue.shift();
      currentPass.resources.forEach(deferredCall => {
        deferredCall();
        shiftDefersToQueue();
      });
      currentPass.datas.forEach(deferredCall => deferredCall());
      for (const typeName of Object.keys(currentPass.modifies)) {
        const byId = currentPass.modifies[typeName];
        for (const id of Object.keys(byId)) {
          try {
            onModified(id, typeName, byId[id]);
          } catch (error) {
            throw wrapError(error, `During snapshotPartition.onModified(${id}:${typeName}):`,
                byId[id]);
          }
        }
      }
    }
  }
  */
}
