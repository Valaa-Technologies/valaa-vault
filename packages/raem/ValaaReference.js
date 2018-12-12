// @flow

import ValaaURI, { createPartitionURI, getPartitionRawIdFrom } from "~/raem/ValaaURI";

import GhostPath, { JSONGhostPath, ghostPathFromJSON } from "~/raem/state/GhostPath";

import { HostRef, tryHostRef } from "~/raem/VALK/hostReference";

import wrapError, { dumpObject } from "~/tools/wrapError";
import invariantify, { invariantifyString, invariantifyObject } from "~/tools/invariantify";
import { vdocorate } from "~/tools/vdon";

export type RawId = string;

@vdocorate([
  `ValaaReference is a reference object to a Valaa Resource and the
  internal representation of a urn:valos URI. Its semantic value
  identity is the urn NSS part, accessible via .rawId.
  ValaaReference contains the urn p-, r-, and f-components.

  Valaa URI: it is
  a value data object which contains all necessary runtime information
  to reference a valaa object, possibly as part of a coupling.`,
  `ValaaReference is the *HostRef* type for VALK.`,
  { fields: {
    rawId: `an id string which identifies the target`,
    ghostPath: `a GhostPath object which specifies the ghost
                  instantiation path, for locating the actual ghost
                  content: the ghost itself might not be materialized.`,
    coupledField: `the coupled field name on the target Resource which
                  contains a backreference to a referring Resource if
                  this reference is part of a coupling.`,
    partitionURI: `for cross-partition Valaa references partitionURI
                  denotes the fully specified universal location of the
                  target partition.`,
  } },
  `Because many use cases only need the rawId there is a collection
  type:`,
  `type IdData = VRef | string`,
  "",
  `IdData allows passing in a plain id string in most places where an
  object reference is required. This usage has limitations, however.
  Because rawId only specifies the identity of an object it cannot be
  reliably used to locate the object content in isolation. The most
  notable examples of this are immaterial ghosts and cross-partition
  references: Immaterial ghosts inherit their properties from a
  prototype but don't data have any data entries themselves (by
  design). The ghostPath is required to locate the prototypes. For a
  cross-partition reference the target partition might not necessarily
  be loaded: partitionURI (which the Valaa infrastructure guarantees to
  be locateable) is needed in this case.`,
  "@export",
  "@class ValaaReference",
])
/**
 * ValaaReference is a value data object which contains all necessary
 * runtime information to reference a valaa object, possibly as part of
 * a coupling.
 *
 * @export
 * @class VRef
 */
export default class ValaaReference {
  _isInactive: ?boolean;
  _mostInheritedMaterializedTransient: Object;

  _nss: string; // urn namespace-specific string ie. valos rawId
  // urn components
  _q: Object; // urn q-component ie. query
  _r: Object; // urn r-component ie. resolver
  // partition: ?ValaaURI ?
  _f: ?string; // urn f-component ie. fragment

  constructor (rawId: ?string) {
    if (rawId) this._nss = rawId;
  }
  initNSS (nss: string) { return this._initPart("_nss", nss); }
  initQueryComponent (query: Object) { return this._initPart("_q", query); }
  initResolverComponent (resolver: Object) { return this._initPart("_r", resolver); }
  initFragmentComponent (fragment: string) { return this._initPart("_fragment", fragment); }
  _initPart (partName, value) {
    if (value) {
      if (this.hasOwnProperty(partName)) {
        throw new Error(`Cannot reinitialize ValaaReference.${partName} with new value (${
            JSON.stringify(value)}) when own value exists (${JSON.stringify(this[partName])})"`);
      }
      this[partName] = value;
    }
    return this;
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

  typeof (): string { return "Resource"; }

  getCoupledField (): ?string { return this._q.coupling; }

  coupleWith (coupledField): VRef {
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
    if (this._nss !== connectedGhostPath.headRawId()) {
      throw new Error(`Inconsistent ValaaReference: this.rawId !== connectedGhostPath.headRawId, ${
          ""} with rawId: '${this._nss}' and ghostPath.headRawId: '${
          connectedGhostPath.headRawId()}'`);
    }
    this.obtainOwnResolverComponent().ghostPath = connectedGhostPath;
    return connectedGhostPath;
  }
  previousGhostStep (): ?GhostPath {
    return this._r.ghostPath && this._r.ghostPath.previousStep();
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

  // Partitions section

  isInactive (): ?boolean { return this._r.inactive || false; }
  setInactive (value: boolean = true): ?boolean {
    this.obtainOwnResolverComponent().inactive = value;
  }

  getPartitionURI (): ?ValaaURI { return this._r.partition; }
  getPartitionRawId (): ?string {
    try {
      return getPartitionRawIdFrom(this._r.partition);
    } catch (error) {
      throw wrapError(error, `During ${this.debugId()}\n .getPartitionRawId(), with:`,
          "\n\tpartitionURI:", this._r.partition);
    }
  }
  setPartitionURI (partitionURI: ValaaURI) {
    try {
      if (this._r.partition) {
        throw new Error(`partitionURI already exists when trying to assign '${
            partitionURI}' into ${this.toString()}`);
      }
      if ((typeof partitionURI !== "object") || !partitionURI || !partitionURI.href) {
        invariantifyObject(partitionURI, "setPartitionURI.partitionURI",
            { instanceof: ValaaURI, allowEmpty: true });
      }
      this.obtainOwnResolverComponent().partition = partitionURI;
    } catch (error) {
      throw wrapError(error, `During ${this.debugId()}\n .setPartitionURI(), with:`,
          "\n\tpartitionURI:", partitionURI,
          "\n\tthis:", ...dumpObject(this));
    }
  }
  clearPartitionURI () { this._r.partition = undefined; }
  immutatePartitionURI (partitionURI?: ValaaURI) {
    const ret = Object.create(this);
    ret._r = Object.create(ret._r);
    ret._r.partition = partitionURI;
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
        if (value && (typeof value !== "string")) {
          if (value instanceof GhostPath) {
            value = (nest && value.previousStep()) ? value.toURIString() : undefined;
          } else if (value instanceof ValaaURI) value = encodeURIComponent(String(value));
          else value = encodeURIComponent(JSON.stringify(value));
        }
        if (!value) return acc;
        return `${acc ? `${acc}&` : prefix}${param}=${value}`;
      }, "");
    }
  }

  toJSON (): any[] {
    const ret = [this._nss];
    if (this._f) ret[3] = this._f;
    if (ret.length > 3) ret[2] = {};
    if (this._q) {
      if (this._q.coupling) (ret[2] || (ret[2] = {})).coupling = this._q.coupling;
    }
    if (ret.length > 2) ret[1] = {};
    if (this._r) {
      if (this._r.partition) (ret[1] || (ret[1] = {})).partition = this._r.partition.toString();
      if (this._r.ghostPath && this._r.ghostPath.previousStep()) {
        (ret[1] || (ret[1] = {})).ghostPath = this._r.ghostPath.toJSON();
      }
    }
    return ret;
  }

  static VRefValueOf = Symbol("VRef.valueOf");

  valueOf (): string {
    let ret = this[ValaaReference.VRefValueOf];
    if (ret === undefined) {
      ret = `VRef(${this._nss},'${this.getCoupledField() || ""}')`;
      // this[VRefValueOf] = ret; // JEST doesn't deal well with temporary values like this
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

ValaaReference.prototype[HostRef] = null;
ValaaReference.prototype._q = Object.freeze({});
ValaaReference.prototype._r = Object.freeze({});

export type VRef = ValaaReference;
export type IdData = string | VRef;

export type JSONVRef = [RawId, ?string, ?JSONGhostPath, ?string];
export type JSONIdData = string | JSONVRef;

export function isIdData (value: any): boolean {
  return (typeof value === "string") || (value instanceof ValaaReference);
}

export function isJSONIdData (value: any): boolean {
  return Array.isArray(value) && (typeof value[0] === "string");
}

export function invariantifyId (candidate: any, name: string = "id",
    { value, valueInvariant, allowNull, allowUndefined, suffix = "", parent }: Object = {},
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
 * Create a Valaa reference.
 *
 * @export
 * @param {string} idData
 * @param {string} coupling
 * @param {GhostPath} ghostPath
 * @param {ValaaURI} partitionURI
 * @returns {VRef}
 */
export function vRef (rawId: RawId, coupling: ?string = null, ghostPath: ?GhostPath = null,
    partitionURI: ?ValaaURI = null): VRef {
  try {
    invariantifyString(rawId, "vRef.rawId");
    invariantifyString(coupling, "vRef.coupling", { allowNull: true });
    invariantifyObject(ghostPath, "vRef.ghostPath", { allowNull: true, instanceof: GhostPath });
    invariantifyObject(partitionURI, "vRef.partitionURI",
        { allowNull: true, allowEmpty: true, instanceof: ValaaURI });
    const ret = new ValaaReference(rawId);
    let resolverComponent;
    if (ghostPath) resolverComponent = { ghostPath };
    if (partitionURI) (resolverComponent || (resolverComponent = {})).partition = partitionURI;
    if (resolverComponent) ret.initResolverComponent(resolverComponent);
    if (coupling) ret.initQueryComponent({ coupling });
    return ret;
  } catch (error) {
    throw wrapError(error, `During vRef('${rawId
            }', { coupling: '${coupling}' ghostPath: ${String(ghostPath)
            } }, { partition: '${String(partitionURI)}' }}), with:`,
        "\n\tghostPath:", ghostPath);
  }
}

export const obtainVRef = vdocorate([
  `Returns a new VRef object copied or deserialized from given idData,
  with its fields overridden with given coupling, ghostPath and/or
  partitionURI. If any of the overrides is null the original value is
  kept.`,
  "@export",
  "@param {IdData} idData",
  "@param {string=tryCoupledFieldFrom(idData)} coupling",
  "@param {GhostPath=tryGhostPathFrom(idData)} ghostPath",
  "@param {ValaaURI=tryPartitionURIFrom(idData)} partitionURI",
  "@returns {VRef}",
])((idData: IdData | JSONIdData,
    coupling: ?string = tryCoupledFieldFrom(idData) || null,
    ghostPath: ?GhostPath = tryGhostPathFrom(idData) || null,
    partitionURI: ?ValaaURI = tryPartitionURIFrom(idData) || null): VRef =>
        vRef(getRawIdFrom(idData), coupling, ghostPath, partitionURI));

/**
 * Returns rawId from given idData or throws if the input does not have a valid rawId.
 * If idData is a string it is used as rawId candidate.
 * If idData is a VRef its .rawId() is called and used as rawId candidate.
 *
 * @export
 * @param {IdData} idData
 * @returns {string}
 */
export function getRawIdFrom (idData: IdData | JSONIdData): string {
  const ret = tryRawIdFrom(idData);
  if (ret) return ret;
  throw new Error(`getRawIdFrom.idData must be a string, VRef or serialized VRef JSON, got: ${
      idData}`);
}


/**
 * Returns rawId from given idData or undefined if the input does not have a valid rawId.
 * If idData is a string it is used as the rawId candidate.
 * If idData is a VRef its .rawId() is called and used as the rawId candidate.
 *
 * @export
 * @param {IdData} idData
 * @returns null
 */
export function tryRawIdFrom (idData: IdData | JSONIdData): ?string {
  if (typeof idData === "string") return idData;
  if (idData instanceof ValaaReference) return idData._nss;
  if (Array.isArray(idData)) return idData[0];
  return undefined;
}


/**
 * Returns active ghostPath from given idData or throws if the input does not have one.
 * If idData is a VRef its .getGhostPath() is called and used as the ghostPath candidate.
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
 * If idData is a VRef its .getGhostPath() is called and used as the ghostPath candidate.
 *
 * @export
 * @param {IdData} idData
 * @returns null
 */
export function tryGhostPathFrom (idData: IdData): ?GhostPath {
  if (idData instanceof ValaaReference) return idData.isGhost() ? idData.getGhostPath() : undefined;
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
 * found. If idData is a VRef its .getCoupledField() is called and used as the candidate.
 *
 * @export
 * @param {IdData} idData
 * @returns null
 */
export function tryCoupledFieldFrom (idData: IdData | JSONIdData): ?string {
  if (idData instanceof ValaaReference) return idData.getCoupledField();
  if (!Array.isArray(idData)) return undefined;
  if (idData[2] && (typeof idData[2] === "object")) return idData[2].coupling;
  if (typeof idData[1] === "string") return idData[1];
  return undefined;
}

export const tryPartitionURIFrom = vdocorate(`
  Returns partitionURI from given idData or undefined if no valid
  partitionURI can be found. If idData is a VRef its .getPartitionURI() is
  called and used as the candidate.
  @export
  @param {IdData} idData
  @returns null
`)((idData: IdData | JSONIdData): ?ValaaURI => {
  if (idData instanceof ValaaReference) return idData.getPartitionURI();
  if (!Array.isArray(idData)) return undefined;
  if (idData[1] && (typeof idData[1] === "object")) {
    return (typeof idData[1].partition !== "string")
        ? idData[1].partition
        : createPartitionURI(idData[1].partition);
  }
  if (((typeof idData[1] === "string") || (idData[1] === null))
      && (typeof idData[3] === "string")) {
    return createPartitionURI(idData[3]);
  }
  return undefined;
});
