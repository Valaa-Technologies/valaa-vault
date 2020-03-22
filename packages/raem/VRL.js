// @flow

import ValaaURI, { naiveURI } from "~/raem/ValaaURI";

import GhostPath, { JSONGhostPath, ghostPathFromJSON } from "~/raem/state/GhostPath";

import { HostRef, tryHostRef } from "~/raem/VALK/hostReference";
import { coerceAsVRID } from "~/raem/VPath";

import { debugObjectType, dumpObject, wrapError } from "~/tools/wrapError";
import invariantify, { invariantifyString } from "~/tools/invariantify";
import { vdocorate } from "~/tools/vdon";

export type RawId = string;

export default @vdocorate([
  `VRL, ValOS Resource Locator, is a reference object to a ValOS
  Resource and the internal representation of a urn:valos URI. Its
  semantic value identity is the urn NSS part, accessible via .rawId.
  VRL contains the urn p-, r-, and f-components.

  Valaa URI: it is
  a value data object which contains all necessary runtime information
  to reference a ValOS object, possibly as part of a coupling.`,
  `VRL is the *HostRef* type for VALK.`,
  { fields: {
    rawId: `an id string which identifies the target`,
    ghostPath: `a GhostPath object which specifies the ghost
                  instantiation path, for locating the actual ghost
                  content: the ghost itself might not be materialized.`,
    coupledField: `the coupled field name on the target Resource which
                  contains a backreference to a referring Resource if
                  this reference is part of a coupling.`,
    chronicleURI: `for cross-chronicle ValOS references the chronicleURI
                  denotes the fully specified universal location of the
                  target chronicle.`,
  } },
  `Because many use cases only need the rawId there is a collection
  type:`,
  `type IdData = VRL | string`,
  "",
  `IdData allows passing in a plain id string in most places where an
  object reference is required. This usage has limitations, however.
  Because rawId only specifies the identity of an object it cannot be
  reliably used to locate the object content in isolation. The most
  notable examples of this are immaterial ghosts and cross-chronicle
  references: Immaterial ghosts inherit their properties from a
  prototype but don't data have any data entries themselves (by
  design). The ghostPath is required to locate the prototypes. For a
  cross-chronicle reference the target chronicle might not necessarily
  be loaded: chronicleURI (which the ValOS infrastructure guarantees to
  be locateable) is needed in this case.`,
  "@export",
  "@class VRL",
])
/**
 * VRL is a value data object which contains all necessary
 * runtime information to reference a ValOS object, possibly as part of
 * a coupling.
 *
 * @export
 * @class VRL
 */
class VRL {
  _nss: string; // urn namespace-specific string ie. valos rawId
  // urn components
  _q: Object; // urn q-component ie. query
  _r: Object; // urn r-component ie. resolver
  // chronicle: ?ValaaURI ?
  _f: ?string; // urn f-component ie. fragment

  initNSS (nss: string) {
    if (nss) this._initPart("_nss", (nss[0] === "@") ? nss : coerceAsVRID(nss));
    return this;
  }
  initQueryComponent (query: Object) { return this._initPart("_q", query); }
  initResolverComponent (resolver: Object) {
    if (!resolver) return this;
    if (!resolver.partition) {
      if (resolver.hasOwnProperty("partition")) delete resolver.partition;
    } else resolver.partition = naiveURI.createPartitionURI(resolver.partition);
    if (!resolver.ghostPath) {
      if (resolver.hasOwnProperty("ghostPath")) delete resolver.ghostPath;
    } else if (!(resolver.ghostPath instanceof GhostPath)) {
      resolver.ghostPath = ghostPathFromJSON(resolver.ghostPath);
    }
    if (!Object.keys(resolver).length) return this;
    return this._initPart("_r", resolver);
  }
  initFragmentComponent (fragment: string) { return this._initPart("_fragment", fragment); }
  _initPart (partName, value) {
    if (value) {
      if (this.hasOwnProperty(partName)) {
        throw new Error(`Cannot reinitialize VRL.${partName} with new value (${
            JSON.stringify(value)}) when own value exists (${JSON.stringify(this[partName])})"`);
      }
      this[partName] = value;
    }
    return this;
  }

  getObjectId (): VRL {
    if (this.hasOwnProperty("_nss")) return this;
    return this.getObjectId.call(Object.getPrototypeOf(this));
  }
  getQueryComponent (): Object { return this._q; }
  getResolverComponent (): Object { return this._r; }
  getFragmentComponent (): string { return this._f; }
  obtainOwnQueryComponent (): Object {
    return this.hasOwnProperty("_q") ? this._q : (this._q = Object.create(this._q));
  }
  obtainOwnResolverComponent (): Object {
    return this.hasOwnProperty("_r") ? this._r : (this._r = Object.create(this._r));
  }

  debugId (): string { return this.toString(); }

  rawId (): RawId { return this._nss; }
  vrid (): string { return this._vrid || (this._vrid = coerceAsVRID(this._nss)); }

  typeof (): string { return "Resource"; }

  getCoupledField (): ?string { return this._q.coupling; }

  coupleWith (coupledField): VRL {
    if (coupledField === undefined) return this;
    const ret = Object.create(this);
    ret._q = Object.create(ret._q);
    // The external name for 'coupledField' string is coupling.
    // Internally coupling refers to the configuration objects which
    // define the behaviour of the coupling.
    ret._q.coupling = coupledField;
    return ret;
  }

  // Ghost sections

  getGhostPath (): GhostPath {
    return this._r.ghostPath || this.connectGhostPath(new GhostPath(this._nss));
  }
  tryGhostPath (): ?GhostPath { return this._r.ghostPath; }

  connectGhostPath (connectedGhostPath: GhostPath) {
    if (this._nss !== connectedGhostPath.headRawId()
        && (this._nss !== coerceAsVRID(connectedGhostPath.headRawId()))) {
      throw new Error(`Inconsistent VRL: this.rawId !== connectedGhostPath.headRawId, ${
          ""} with rawId: '${this._nss}' and ghostPath.headRawId: '${
          connectedGhostPath.headRawId()}'`);
    }
    if (!(connectedGhostPath instanceof GhostPath)) {
      throw new Error(`connectGhostPath: expected GhostPath, got: '${
          debugObjectType(connectedGhostPath)}'`);
    }
    this.obtainOwnResolverComponent().ghostPath = connectedGhostPath;
    return connectedGhostPath;
  }
  previousGhostStep (): ?GhostPath {
    return this._r.ghostPath && this._r.ghostPath.previousGhostStep();
  }

  isInherited (): ?boolean {
    return this._r.ghostPath ? this._r.ghostPath.isInherited() : false;
  }
  isGhost (): ?boolean {
    return this._r.ghostPath ? this._r.ghostPath.isGhost() : false;
  }
  isInstance (): ?boolean {
    return this._r.ghostPath ? this._r.ghostPath.isInstance() : false;
  }

  // Chronicles section

  isAbsent (): ?boolean { return this._r.absent || false; }
  setAbsent (value: boolean = true): ?boolean {
    this.obtainOwnResolverComponent().absent = value;
    return this;
  }
  isInactive (): ?boolean {
    console.warn("VRL.isInactive DEPRECATED in favor of .isAbsent");
    return this.isAbsent();
  }
  setInactive (value: boolean = true): ?boolean {
    console.warn("VRL.setInactive DEPRECATED in favor of .setAbsent");
    return this.setAbsent(value);
  }

  getChronicleURI (): string { return this._r.partition; }
  getChronicleId (): ?string {
    try {
      return naiveURI.getPartitionRawId(this._r.partition);
    } catch (error) {
      throw wrapError(error, `During ${this.debugId()}\n .getPartitionRawId(), with:`,
          "\n\tchronicleURI:", this._r.partition);
    }
  }

  setChronicleURI (chronicleURI: ValaaURI) {
    try {
      if (this._r.partition) {
        throw new Error(`chronicleURI already exists when trying to assign '${
          chronicleURI}' into ${this.toString()}`);
      }
      if (typeof chronicleURI !== "string") {
        invariantifyString(chronicleURI, "setChronicleURI.chronicleURI", { allowEmpty: true });
      }
      this.obtainOwnResolverComponent().partition = chronicleURI;
    } catch (error) {
      throw wrapError(error, `During ${this.debugId()}\n .setChronicleURI(), with:`,
          "\n\tchronicleURI:", chronicleURI,
          "\n\texisting chronicle:", this._r.partition,
          "\n\tthis:", ...dumpObject(this));
    }
  }
  clearChronicleURI () { this._r.partition = undefined; }
  immutateWithChronicleURI (chronicleURI?: string) {
    const ret = Object.create(this);
    ret._r = Object.create(ret._r);
    ret._r.partition = chronicleURI;
    return ret;
  }

  // Primitive operations, introspection and serialization

  toString (nest: number = 1): string {
    const resolverComponent = stringifyComponent(this._r, "?+");
    const queryComponent = stringifyComponent(this._q, "?=");
    const fragmentComponent = (this._f && `#${encodeURIComponent(this._f)}`) || "";
    return `urn:valos:${this._nss || ""}${resolverComponent}${queryComponent}${fragmentComponent}`;

    function stringifyComponent (component, prefix) {
      if (!component) return "";
      return Object.keys(component).sort().reduce((acc, param) => {
        let value = component[param];
        if (typeof value === "string") value = encodeURIComponent(value);
        else if (value instanceof GhostPath) {
          value = (nest && value.isGhost()) ? value.toURIString() : undefined;
        } else if (value) value = encodeURIComponent(JSON.stringify(value));
        if (!value) return acc;
        return `${acc ? `${acc}&` : prefix}${param}=${value}`;
      }, "");
    }
  }

  toJSON (): any[] {
    const ret = [this._nss, {}, {}, ""];
    let usedFields = 1;
    if (this._f) { ret[3] = this._f; usedFields = 4; }
    if (this._q) {
      if (this._q.coupling) {
        ret[2].coupling = this._q.coupling;
        if (usedFields < 3) usedFields = 3;
      }
    }
    if (this._r) {
      if (this._r.partition) {
        ret[1].partition = this._r.partition.toString();
        if (typeof ret[1].partition !== "string") {
          throw new Error(`Invalid stringification of chronicle ${this._r.partition}`);
        }
        if (usedFields < 2) usedFields = 2;
      }
      if (this._r.ghostPath && this._r.ghostPath.isGhost()) {
        ret[1].ghostPath = this._r.ghostPath.toJSON();
        if (usedFields < 2) usedFields = 2;
      }
    }
    ret.length = usedFields;
    return ret;
  }

  static VRLValueOf = Symbol("VRL.valueOf");

  valueOf (): string {
    let ret = this[VRL.VRLValueOf];
    if (ret === undefined) {
      ret = `VRL(${this._nss},'${this.getCoupledField() || ""}')`;
      // this[VRLValueOf] = ret; // JEST doesn't deal well with temporary values like this
    }
    return ret;
  }

  equals (other: any): boolean {
    const otherRef = tryHostRef(other);
    if (this === otherRef) return true;
    if (otherRef) {
      return this._nss === otherRef._nss
          && (this.getCoupledField() === otherRef.getCoupledField());
    }
    return (this._nss === getRawIdFrom(other))
          && (this.getCoupledField() === tryCoupledFieldFrom(other));
  }
  hashCode (): number {
    if (this._hashCode) return this._hashCode;
    const id = this._nss;
    const len = Math.min(id.length, 8);
    let ret = 0;
    for (let i = 0; i < len; ++i) {
      ret += id.charCodeAt(i) << (8 * i); // eslint-disable-line no-bitwise
    }
    this._hashCode = ret;
    return ret;
  }
}

VRL.prototype[HostRef] = null;
VRL.prototype._q = Object.freeze({});
VRL.prototype._r = Object.freeze({});

export type { VRL };
export type IdData = string | VRL;

export type JSONVRL = [RawId, ?string, ?JSONGhostPath, ?string];
export type JSONIdData = string | JSONVRL;

export function isIdData (value: any): boolean {
  return (typeof value === "string") || (value instanceof VRL);
}

export function isJSONIdData (value: any): boolean {
  return Array.isArray(value) && (typeof value[0] === "string");
}

export function invariantifyId (candidate: any, name: string = "id",
    { value, valueInvariant, allowNull, allowUndefined, suffix = "" }: Object = {},
    ...additionalContextInformation: any) {
  if (((isIdData(candidate) || isJSONIdData(candidate))
          && (typeof value === "undefined" || (candidate === value))
          && (!valueInvariant || valueInvariant(candidate)))
      || ((typeof candidate === "undefined") && allowUndefined)
      || (candidate === null && allowNull)) return true;

  return invariantify(false,
      `'${name}' must be a valid id-data${
          typeof value !== "undefined" ? ` with exact value '${value}'` : ""}${
          valueInvariant ? " obeying given value invariant" : ""}${
          allowNull ? ", or null" : ""}${allowUndefined ? ", or undefined" : ""}${
          suffix}`,
      `\n\t'${name}' candidate:`, candidate,
      ...(valueInvariant ? [`\n\tvalue invariant:`, valueInvariant] : []),
      ...additionalContextInformation);
}

export function invariantifyTypeName (candidate: ?string, name: string = "typeName",
    { value, valueInvariant, allowNull, allowUndefined, suffix = "" }: Object = {},
    ...additionalContextInformation: any) {
  if ((typeof candidate === "string" && (candidate.length)
          && (typeof value === "undefined" || (candidate === value))
          && (!valueInvariant || valueInvariant(candidate)))
      || ((typeof candidate === "undefined") && allowUndefined)
      || (candidate === null && allowNull)) return true;

  return invariantify(false,
      `'${name}' must be a valid type field name${
          typeof value !== "undefined" ? ` with exact value '${value}'` : ""}${
          valueInvariant ? " obeying given value invariant" : ""}${
          allowNull ? ", or null" : ""}${allowUndefined ? ", or undefined" : ""}${
          suffix}`,
      `\n\t'${name}' candidate:`, candidate,
      ...(valueInvariant ? [`\n\tvalue invariant:`, valueInvariant] : []),
      ...additionalContextInformation);
}

/**
 * Create a VRL from given rawId, coupling, ghostPath and chronicleURI.
 *
 * @export
 * @param {string} idData
 * @param {string} coupling
 * @param {GhostPath} ghostPath
 * @param {string} chronicleURI
 * @returns {VRL}
 */
export function vRef (rawId: RawId, coupling: ?string = null, ghostPath: ?GhostPath = null,
    chronicleURI: ?string = null): VRL {
  try {
    if (typeof rawId !== "string") invariantifyString(rawId, "vRef.rawId");
    /*
    invariantifyString(coupling, "vRef.coupling", { allowNull: true });
    invariantifyObject(ghostPath, "vRef.ghostPath", { allowNull: true, instanceof: GhostPath });
    invariantifyString(chronicleURI, "vRef.chronicleURI", { allowNull: true, allowEmpty: true });
    */
    // if (rawId[0] === "@") { validateVRID(rawId); }
    const ret = (new VRL()).initNSS(rawId);
    let resolverComponent;
    if (ghostPath) resolverComponent = { ghostPath };
    if (chronicleURI) (resolverComponent || (resolverComponent = {})).partition = chronicleURI;
    if (resolverComponent) ret.initResolverComponent(resolverComponent);
    if (coupling) ret.initQueryComponent({ coupling });
    return ret;
  } catch (error) {
    throw wrapError(error, `During vRef('${rawId
            }', { coupling: '${coupling}' ghostPath: ${String(ghostPath)
            } }, { partition: '${chronicleURI}' }}), with:`,
        "\n\tghostPath:", ghostPath);
  }
}

export const obtainVRL = vdocorate([
  `Returns a new VRL object copied or deserialized from given idData,
  with its fields overridden with given coupling, ghostPath and/or
  chronicleURI. If any of the overrides is null the original value is
  kept.`,
  "@export",
  "@param {IdData} idData",
  "@param {string=tryCoupledFieldFrom(idData)} coupling",
  "@param {GhostPath=tryGhostPathFrom(idData)} ghostPath",
  "@param {ValaaURI=tryChronicleURIFrom(idData)} chronicleURI",
  "@returns {VRL}",
])((idData: IdData | JSONIdData,
    coupling: ?string = tryCoupledFieldFrom(idData) || null,
    ghostPath: ?GhostPath = tryGhostPathFrom(idData) || null,
    chronicleURI: ?ValaaURI = tryChronicleURIFrom(idData) || null): VRL =>
        vRef(getRawIdFrom(idData), coupling, ghostPath, chronicleURI));

/**
 * Returns rawId from given idData or throws if the input does not have a valid rawId.
 * If idData is a string it is used as rawId candidate.
 * If idData is a VRL its .rawId() is called and used as rawId candidate.
 *
 * @export
 * @param {IdData} idData
 * @returns {string}
 */
export function getRawIdFrom (idData: IdData | JSONIdData): string {
  const ret = tryRawIdFrom(idData);
  if (ret) return ret;
  throw new Error(`getRawIdFrom.idData must be a string, VRL or serialized VRL JSON, got: ${
      idData}`);
}


/**
 * Returns rawId from given idData or undefined if the input does not have a valid rawId.
 * If idData is a string it is used as the rawId candidate.
 * If idData is a VRL its .rawId() is called and used as the rawId candidate.
 *
 * @export
 * @param {IdData} idData
 * @returns null
 */
export function tryRawIdFrom (idData: IdData | JSONIdData): ?string {
  if (idData instanceof VRL) return idData._nss;
  const rawId = (typeof idData === "string")
          ? idData
      : Array.isArray(idData)
          ? idData[0]
          : undefined;
  return rawId[0] === "@" ? rawId : coerceAsVRID(rawId);
}


/**
 * Returns active ghostPath from given idData or throws if the input does not have one.
 * If idData is a VRL its .getGhostPath() is called and used as the ghostPath candidate.
 *
 * @export
 * @param {IdData} idData
 * @returns {GhostPath}
 */
export function getGhostPathFrom (idData: IdData): GhostPath {
  const ret = tryGhostPathFrom(idData);
  if (ret) return ret;
  throw new Error(
      `getGhostPathFrom.idData.ghostPath must be a valid GhostPath, got idData: ${idData}`);
}

/**
 * Returns active ghostPath from given idData or undefined if the input does not have one.
 * If idData is a string the ghostPath is not valid.
 * If idData is a VRL its .getGhostPath() is called and used as the ghostPath candidate.
 *
 * @export
 * @param {IdData} idData
 * @returns null
 */
export function tryGhostPathFrom (idData: IdData): ?GhostPath {
  if (idData instanceof VRL) return idData.isGhost() ? idData.getGhostPath() : undefined;
  if (!Array.isArray(idData)) return undefined;
  if (idData[1] && (typeof idData[1] === "object")) {
    const path = idData[1].ghostPath;
    return (!path || (path instanceof GhostPath)) ? path : ghostPathFromJSON(path);
  }
  if (Array.isArray(idData[2])) return ghostPathFromJSON(idData[2]);
  return undefined;
}

/**
 * Returns coupledField from given idData or undefined if no valid coupledField can be
 * found. If idData is a VRL its .getCoupledField() is called and used as the candidate.
 *
 * @export
 * @param {IdData} idData
 * @returns null
 */
export function tryCoupledFieldFrom (idData: IdData | JSONIdData): ?string {
  if (idData instanceof VRL) return idData.getCoupledField();
  if (!Array.isArray(idData)) return undefined;
  if (idData[2] && (typeof idData[2] === "object")) return idData[2].coupling;
  if (typeof idData[1] === "string") return idData[1];
  return undefined;
}

export const tryChronicleURIFrom = vdocorate(`
  Returns chronicleURI from given idData or undefined if no valid
  chronicleURI can be found. If idData is a VRL its .getChronicleURI() is
  called and used as the candidate.
  @export
  @param {IdData} idData
  @returns null
`)((idData: IdData | JSONIdData): ?string => {
  if (idData instanceof VRL) return idData.getChronicleURI();
  if (!Array.isArray(idData)) return undefined;
  if (idData[1] && (typeof idData[1] === "object")) {
    return (typeof idData[1].partition !== "string")
        ? idData[1].partition
        : naiveURI.createPartitionURI(idData[1].partition);
  }
  if (((typeof idData[1] === "string") || (idData[1] === null))
      && (typeof idData[3] === "string")) {
    return naiveURI.createPartitionURI(idData[3]);
  }
  return undefined;
});
