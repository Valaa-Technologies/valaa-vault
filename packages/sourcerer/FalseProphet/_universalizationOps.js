// @flow

import VRL, { JSONIdData, tryChronicleURIFrom } from "~/raem/VRL";
import { qualifiedNamesOf } from "~/tools/namespace";
import { naiveURI } from "~/raem/ValaaURI";
import { Kuery, isValOSFunction } from "~/raem/VALK";
import { tryHostRef } from "~/raem/VALK/hostReference";
import GhostPath, { ghostPathFromJSON } from "~/raem/state/GhostPath";
// import { coerceAsVRID } from "~/plot";

import { extractFunctionVAKON } from "~/script";

import { dumpObject, debugObjectType, isSymbol, trivialClone, wrapError } from "~/tools";

import FalseProphet from "./FalseProphet";

/*
export function vRefFromURI (uri: ValaaURI | string): VRL {
  const [chronicleURI, fragment] = String(uri).split("#");
  if (!fragment) return vRef("", null, null, createValaaURI(chronicleURI));
  const [rawId, referenceOptions] = fragment.split("?");
  // TODO(iridian): validate rawId against [-_0-9a-zA-Z] and do base64 -> base64url conversion
  // which needs codebase wide changes.
  if (!referenceOptions) return vRef(rawId, null, null, createValaaURI(chronicleURI));
  // const options = {};
  let coupling;
  for (const [key, value] of referenceOptions.split("&").map(pair => pair.split("="))) {
    if (key === "coupling") coupling = value;
    else throw new Error(`VRL option '${key}' not implemented yet`);
  }
  return vRef(rawId, coupling, undefined, createValaaURI(chronicleURI));
}
*/

/*
export function vRefFromJSON (json: JSONIdData, RefType: Object = VRL): VRL {
  const ret = new RefType(json);
  if ((typeof ret[PackedHostValue][2] === "string")
      || (ret[PackedHostValue][1] && typeof ret[PackedHostValue][1] === "object")) {
    // Flip obsolete coupledField / ghostPath order.
    console.warn("Encounted obsolete VRL field order, expected " +
        "[rawId, coupledField, ghostPath], got [rawId, ghostPath, coupledField]");
    const temp = ret[PackedHostValue][1];
    ret[PackedHostValue][1] = ret[PackedHostValue][2];
    ret[PackedHostValue][2] = temp;
  }
  if (ret[PackedHostValue][2] && !(ret[PackedHostValue][2] instanceof GhostPath)) {
    ret[PackedHostValue][2] = ghostPathFromJSON(ret[PackedHostValue][2]);
  }
  if (ret[PackedHostValue][3] && !(ret[PackedHostValue][3] instanceof ValaaURI)) {
    ret[PackedHostValue][3] = naiveURI.createPartitionURI(ret[PackedHostValue][3]);
  }
  return ret;
}
*/

// rfc3986 uri regex for reference: ^(([^:/?#]+):)?(//([^/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?

const urnValOSRegExpString = "^(urn:valos:)(([^#?]*)(\\?\\+([^#]*))?(\\?=([^#]*))?(#(.*))?)?$";
const valOSURIRegExpString = "^([^:/?#]+:[^#]*)(#([^#?;]*)(\\?\\+([^#]*))?(\\?=([^#]*))?)?$";
const urnValOSRegExp = new RegExp(urnValOSRegExpString);
const valOSURIRegExp = new RegExp(valOSURIRegExpString);

const oldRawIdRegExpString = "^([a-zA-Z0-9+/_-]*)$";
const oldRawIdRegExp = new RegExp(oldRawIdRegExpString);

export function deserializeVRL (serializedRef: string | JSONIdData,
    currentChronicleURI?: string, falseProphet: ?FalseProphet, isInRefClause: ?boolean) {
  let nss, resolver, query, fragment;
  try {
    if (typeof serializedRef === "string") {
      let parts = serializedRef.match(urnValOSRegExp) || serializedRef.match(valOSURIRegExp);
      if (!parts && isInRefClause) {
        parts = [true, "urn:valos:", serializedRef];
      } else if (!parts) {
        parts = serializedRef.match(oldRawIdRegExp);
        if (parts) {
          console.debug(`DEPRECATED: old-style valos raw id refs in favor of VPlots, got: "${
              serializedRef}"`);
          parts.unshift(null, null);
          parts[1] = "urn:valos:";
        } else {
          throw new Error(`Malformed valos reference "${serializedRef
              }": doesn't match either urn:valos regex /${urnValOSRegExpString}/${
              ""} nor valos URI regex /${valOSURIRegExpString}/`);
        }
      }
      nss = parts[3];
      if (parts[1] !== "urn:valos:") {
        (resolver || (resolver = {})).partition = parts[1];
        if (!nss) nss = naiveURI.getPartitionRawId(parts[1]);
      }
      if (!nss) throw new Error(`Malformed urn:valos reference: empty nss part`);
      if (parts[5]) {
        if (!resolver) resolver = {};
        // explicit resolver.partition overrides the generic ValOS URI
        // authority part.
        parts[5].split("&").map(param => param.split("="))
            .forEach(([key, value]) => { resolver[key] = value; });
      }
      if (parts[7]) {
        if (!query) query = {};
        parts[7].split("&").map(param => param.split("="))
            .forEach(([key, value]) => { query[key] = value; });
      }
      if (parts[9]) fragment = parts[9];
    } else if (!Array.isArray(serializedRef)) {
      throw new Error(`Malformed urn:valos reference ${debugObjectType(serializedRef)
          }, expected URI string or an array expansion`);
    } else if ((serializedRef[0] === "§vrl") || (serializedRef[0] === "§ref")) {
      return deserializeVRL(serializedRef[1], currentChronicleURI, falseProphet, true);
    } else if ((serializedRef.length === 1)
        || (serializedRef[1] && (typeof serializedRef[1] === "object"))) {
      // new-style array expansion: [nss, resolverComponent, queryComponent, fragmentComponent]
      ([nss, resolver, query, fragment] = serializedRef);
      if (resolver) resolver = { ...resolver };
      if (query) query = { ...query };
    } else {
      // old-style array expansion: [rawId, coupling, ghostPath, chronicleURI]
      nss = serializedRef[0];
      resolver = { ghostPath: serializedRef[2], partition: serializedRef[3] };
      query = { coupling: serializedRef[1] };
      /*
      if (falseProphet) {
        falseProphet.warnEvent(1, () => [
          "deserializeVRL encountered an old-style reference which will be deprecated:",
          ...dumpObject(serializedRef),
        ]);
      }
      */
    }

    let chronicleURI = resolver && resolver.partition;
    if (!chronicleURI && currentChronicleURI) {
      (resolver || (resolver = {})).partition = currentChronicleURI;
      chronicleURI = naiveURI.createPartitionURI(String(currentChronicleURI));
    }
    if (!falseProphet || ((currentChronicleURI === null) && !chronicleURI)) {
      return new VRL()
          .initNSS(nss)
          .initResolverComponent(resolver)
          .initQueryComponent(query)
          .initFragmentComponent(fragment);
    }
    if (!chronicleURI) {
      throw new Error(`Cannot deserialize urn:valos reference, no current chronicle provided${
          ""} (and isn't explicitly disabled as 'null') and${
          ""} reference is missing chronicle URI part: "${serializedRef}"`);
    }
    let referencePrototype;
    const connection = falseProphet._connections[chronicleURI];
    referencePrototype = connection
        ? connection._referencePrototype
        : falseProphet._absentChronicleVRLPrototypes[chronicleURI];
    const ghostPath = resolver.ghostPath;
    if (!referencePrototype) {
      resolver.absent = true;
      delete resolver.ghostPath;
      referencePrototype = falseProphet._absentChronicleVRLPrototypes[chronicleURI] =
          new VRL().initResolverComponent(resolver);
    }
    const ret = Object.create(referencePrototype)
        .initNSS(nss)
        .initQueryComponent(query)
        .initFragmentComponent(fragment);
    // ret._nss = nss;
    if (ghostPath) {
      ret.obtainOwnResolverComponent().ghostPath = (ghostPath instanceof GhostPath)
          ? ghostPath : ghostPathFromJSON(ghostPath);
    }
    return ret;
  } catch (error) {
    throw (falseProphet
        ? falseProphet.wrapErrorEvent.bind(falseProphet, error, 1, "deserializeVRL()")
        : wrapError.bind(null, error, "deserializeVRL()"))(
            "\n\tserializedReference:", serializedRef,
            "\n\tcurrentChronicleURI:", currentChronicleURI,
            "\n\tnss:", nss,
            "\n\tresolver:", ...dumpObject(resolver),
            "\n\tquery:", ...dumpObject(query),
            "\n\tfragment:", fragment);
  }
}
/*
_initializeHostValue (vref: [RawId, ?string, ?GhostPath]) {
  this[PackedHostValue] = vref;
  if (this[PackedHostValue][2]) this.connectGhostPath(this[PackedHostValue][2]);
}
*/

export function _universalizeAction (action: ?any, discourse, contextChronicleURI) {
  let id, connectedId;
  const chronicleURI = (action.meta || "").chronicleURI
      || (action.id && tryChronicleURIFrom(action.id))
      || contextChronicleURI;
  for (const [key, value] of Object.entries(action)) {
    switch (key) {
      case "actions":
        for (const subAction of value) {
          _universalizeAction(subAction, discourse, chronicleURI);
        }
        break;
      case "id":
      case "duplicateOf":
        action[key] = tryHostRef(value) || value;
        break;
      case "preOverrides":
      case "initialState":
      case "sets":
      case "adds":
      case "removes":
        _universalizeResourceState(value);
        break;
      /*
      case "id":
      case "type": case "meta": case "aspects":
      case "typeName":
      case "time": case "startTime": case "interpolation": case "extrapolation":
      */
      default: break;
    }
  }
  function _universalizeResourceState (resourceState) {
    for (const [key, entry] of Object.entries(resourceState)) {
      if (key === "value") {
        if (!entry) continue;
        if (entry.typeName === "Literal") {
          if (!chronicleURI || !chronicleURI.startsWith("valaa-memory:")) {
            entry.value = _universalizePropertyLiteralValue(entry.value, action.id);
          }
          continue;
        }
      }
      const newEntry = _universalizeValue(entry);
      if (newEntry !== undefined) resourceState[key] = newEntry;
    }
  }
  function _universalizeValue (value) {
    try {
      if ((value == null) || ((typeof value !== "object") && (typeof value !== "symbol"))) {
        return undefined;
      }
      if (isSymbol(value)) {
        const qualifiedName = qualifiedNamesOf(value);
        if (qualifiedName) {
          return qualifiedName[3];
        }
        throw new Error(`Cannot universalize unrecognized symbol ${String(value)}`);
      }
      if (value instanceof Kuery) throw new Error("Kueries not allowed in actions");
      if (Array.isArray(value)) {
        for (let i = 0; i !== value.length; ++i) {
          const entry = _universalizeValue(value[i]);
          if (entry !== undefined) value[i] = entry;
        }
        return undefined;
      }

      id = tryHostRef(value);
      if (id) {
        if (id === value) return undefined;
        // ValOS reference
        connectedId = discourse.bindFieldVRL(id, {}, null);
        const connectedChronicleURI = connectedId.getChronicleURI();
        if (connectedChronicleURI) {
          if (connectedChronicleURI === contextChronicleURI) {
            return connectedId.immutateWithChronicleURI();
          }
        } else if (connectedId.isGhost()) {
          const ghostChronicleURI = discourse
              .bindObjectId([id.getGhostPath().headHostRawId()], "Resource")
              .getChronicleURI();
          if (ghostChronicleURI !== contextChronicleURI) {
            return connectedId.immutateWithChronicleURI(connectedChronicleURI);
          }
        }
        return connectedId;
      }
      // Data object
      if (Object.getPrototypeOf(value) !== Object.prototype) {
        throw new Error(`Object is not a plain data object, got: ${Object.constructor.name}`);
      }
      for (const [key, entry] of Object.entries(value)) {
        const newEntry = _universalizeValue(entry);
        if (newEntry !== undefined) value[key] = newEntry;
      }
      return undefined;
    } catch (error) {
      throw wrapError(error, `During _universalizeAction(`, value, `), with:`,
          "\n\tid:", ...dumpObject(id),
          "\n\tconnectedId:", ...dumpObject(connectedId));
    }
  }
}

function _universalizePropertyLiteralValue (value, propertyName) {
  return trivialClone(value, (clonee, key, object, cloneeDescriptor, recurseClone) => {
    if (typeof clonee === "function") {
      if (!isValOSFunction(clonee)) {
        throw new Error(`While universalizing into valospace resource property '${
          propertyName}' encountered a non-valospace function at sub-property ${key}': ${
              clonee.name}`);
      }
      return ["§capture", ["§'", extractFunctionVAKON(clonee)], ["§void"], "literal"];
    }
    /*
    if (cloneeDescriptor && (typeof cloneeDescriptor.get === "function")) {
      if (!isValOSFunction(cloneeDescriptor.get)) {
        throw new Error(`While universalizing into valospace resource property '${
            propertyName}' encountered a non-valospace getter for sub-property ${key}': ${
              cloneeDescriptor.get.name}`);
      }
      cloneeDescriptor.enumerable = true;
      cloneeDescriptor.configurable = true;
      // This doesn't work because the kuery property vakon gets
      // evaluated when the property is read. Instead the construct
      // should introduce a getter to the object that is currently
      // being constructed. But there's no support for that yet.
      return extractFunctionVAKON(cloneeDescriptor.get);
    }
    */
    if ((clonee == null) || (typeof clonee !== "object")) return clonee;
    if (Array.isArray(clonee)) {
      const ret_ = clonee.map(recurseClone);
      if ((typeof ret_[0] === "string") && ret_[0][0] === "§") ret_[0] = ["§'", ret_[0]];
      return ret_;
    }
    if (Object.getPrototypeOf(clonee) === Object.prototype) return undefined;
    if (clonee instanceof Kuery) return clonee.toVAKON();
    const cloneeRef = tryHostRef(clonee);
    if (cloneeRef) return ["§vrl", cloneeRef.toJSON()];
    throw new Error(`Cannot universalize non-trivial value ${debugObjectType(value)}`);
  });
}
