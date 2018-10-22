// @flow
import { Iterable } from "immutable";
import { isIdData } from "~/raem/ValaaReference";
import { Kuery } from "~/raem/VALK";
import Vrapper from "~/engine/Vrapper";

import { invariantifyObject } from "~/tools/invariantify";
import wrapError from "~/tools/wrapError";

export default function evaluateToProclamationData (object: ?any, options:
    { head?: Vrapper, transaction?: Object, scope?: Object, partitionURIString?: string } = {}) {
  try {
    if ((typeof object !== "object") || (object === null)) {
      // Literal
      return object;
    }

    if (object instanceof Kuery) {
      // Kuery
      invariantifyObject(options.head,
          "evaluateToProclamationData.kueryOptions: { head } (when initialState contains a Kuery)",
              { instanceof: Vrapper });
      return evaluateToProclamationData(options.head.get(object, Object.create(options)), options);
    }

    if (Array.isArray(object)) {
      // Array
      return object.map(entry => evaluateToProclamationData(entry, options));
    }

    const id = tryIdFromObject(object);
    if (!id) {
      // Plain data object
      if (Object.getPrototypeOf(object) !== Object.prototype) {
        throw new Error(`Object is not a plain data object: ${Object.constructor.name}`);
      }
      const ret = {};
      for (const key of Object.keys(object)) {
        ret[key] = evaluateToProclamationData(object[key], options);
      }
      return ret;
    }

    // Valaa reference
    if (!options.transaction) return id;
    const connectedId = options.transaction.bindFieldVRef(id, { bindPartition: true });
    const partitionURI = connectedId.getPartitionURI();
    if (partitionURI && (partitionURI.toString() === options.partitionURIString)) {
      return connectedId.immutatePartitionURI();
    }
    return connectedId;
  } catch (error) {
    throw wrapError(error, `During evaluateToProclamationData(`, object, `)`);
  }
}

function tryIdFromObject (object: any) {
  if (object instanceof Vrapper) return object.getId();
  if (Iterable.isKeyed(object)) return object.get("id");
  if (isIdData(object)) return object;
  return undefined;
}
