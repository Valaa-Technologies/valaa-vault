// @flow
import { Iterable } from "immutable";
import { isIdData } from "~/raem/VRL";
import { Kuery } from "~/raem/VALK";
import Vrapper from "~/engine/Vrapper";

import { invariantifyObject } from "~/tools/invariantify";
import { dumpObject, wrapError } from "~/tools/wrapError";

export default function universalizeCommandData (object: ?any, options:
    { head?: Vrapper, transaction?: Object, scope?: Object, partitionURIString?: string } = {}) {
  let id, connectedId;
  try {
    if ((typeof object !== "object") || (object === null)) {
      // Literal
      return object;
    }

    if (object instanceof Kuery) {
      // Kuery
      invariantifyObject(options.head,
          "universalizeCommandData.kueryOptions: { head } (when initialState contains a Kuery)",
              { instanceof: Vrapper });
      return universalizeCommandData(options.head.get(object, Object.create(options)), options);
    }

    if (Array.isArray(object)) {
      // Array
      return object.map(entry => universalizeCommandData(entry, options));
    }

    id = tryIdFromObject(object);
    if (!id) {
      // Plain data object
      if (Object.getPrototypeOf(object) !== Object.prototype) {
        throw new Error(`Object is not a plain data object, got: ${Object.constructor.name}`);
      }
      const ret = {};
      for (const key of Object.keys(object)) {
        ret[key] = universalizeCommandData(object[key], options);
      }
      return ret;
    }

    // ValOS reference
    if (!options.transaction) return id;
    connectedId = options.transaction.bindFieldVRL(id, {}, null);
    const partitionURI = connectedId.getPartitionURI();
    if (partitionURI) {
      if (String(partitionURI) === options.partitionURIString) {
        return connectedId.immutateWithPartitionURI();
      }
    } else if (connectedId.isGhost()) {
      const ghostPartitionURI = options.transaction
          .bindObjectId([id.getGhostPath().headHostRawId()], "Resource")
          .getPartitionURI();
      if (ghostPartitionURI.toString() !== options.partitionURIString) {
        return connectedId.immutateWithPartitionURI(partitionURI);
      }
    }
    return connectedId;
  } catch (error) {
    throw wrapError(error, `During universalizeCommandData(`, object, `), with:`,
        "\n\tid:", ...dumpObject(id),
        "\n\tconnectedId:", ...dumpObject(connectedId));
  }
}

function tryIdFromObject (object: any) {
  if (object instanceof Vrapper) return object.getId();
  if (Iterable.isKeyed(object)) return object.get("id");
  if (isIdData(object)) return object;
  return undefined;
}
