// @flow
import { Iterable } from "immutable";
import { isIdData } from "~/raem/VRL";
import { Kuery } from "~/raem/VALK";
import { HostRef } from "~/raem/VALK/hostReference";

import { qualifiedNameOf } from "~/script";

import Vrapper from "~/engine/Vrapper";

import { dumpObject, invariantifyObject, isSymbol, wrapError } from "~/tools";

export default function universalizeCommandData (object: ?any, options:
    { head?: Vrapper, discourse?: Object, scope?: Object, chronicleURI?: string } = {}) {
  let id, connectedId;
  try {
    if ((object === null) || ((typeof object !== "object") && (typeof object !== "symbol"))) {
      // Literal
      return object;
    }

    if (isSymbol(object)) {
      const qualifiedName = qualifiedNameOf(object)
      if (qualifiedName) {
        return qualifiedName[3];
      }
      throw new Error(`Cannot universalize unrecognized symbol ${String(object)}`);
    }

    if (object instanceof Kuery) {
      // Kuery
      invariantifyObject(options.head,
          "universalizeCommandData.kueryOptions: { head } (when initialState contains a Kuery)",
              { instanceof: Vrapper });
      return universalizeCommandData(options.head.step(object, Object.create(options)), options);
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
    if (!options.discourse) return id;
    connectedId = options.discourse.bindFieldVRL(id, {}, null);
    const chronicleURI = connectedId.getChronicleURI();
    if (chronicleURI) {
      if (chronicleURI === options.chronicleURI) {
        return connectedId.immutateWithChronicleURI();
      }
    } else if (connectedId.isGhost()) {
      const ghostChronicleURI = options.discourse
          .bindObjectId([id.getGhostPath().headHostRawId()], "Resource")
          .getChronicleURI();
      if (ghostChronicleURI !== options.chronicleURI) {
        return connectedId.immutateWithChronicleURI(chronicleURI);
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
  const hostRef = object[HostRef];
  if (hostRef) return hostRef;
  if (Iterable.isKeyed(object)) return object.get("id");
  if (isIdData(object)) return object;
  return undefined;
}
