// @flow

import type { RawId } from "~/raem/VRL";

import { invariantifyString } from "~/tools/invariantify";
import derivedId from "~/tools/id/derivedId";

export function createGhostRawId (ghostPrototypeRawId: string, instanceRawId: string): string {
  return derivedId(ghostPrototypeRawId, "instance", instanceRawId);
}

export type JSONGhostStep =
      /* instance step */ RawId
    | [/* host prototype */ RawId, /* host */ RawId, /* ghost */ RawId];

export type JSONGhostPath = Array<JSONGhostStep>;

const hostPrototypeRawIdKey = Symbol("GhostPath.hostPrototypeRawIdKey");

/**
 * GhostPath is a non-persisted lookup structure for finding ghost instance id's on an instantiation
 * path, so that:
 * 1. each step of the path is associated with an object
 * 2. the object of first step (root step) is some non-ghost root object
 * 3. each subsequent step corresponds to an _instantiation of some (grand)owner_ of the object of
 *    the previous step.
 * 3.1. This (grand)owner is referred to as ghost host prototype of the step.
 * 3.2. The instantiation is referred to as the ghost host of the step.
 * 4. the associated object of each instantiation step is a ghost instance of the object of
 *    the previous step.
 * 5. Each instantiation step has a lookup mapping:
 *   ghostHostPrototypeId: RawId -> [ghostHostId: RawId, ghostId: RawId]
 * 5.1. The root lookup mapping for the root step is:
 *   "" -> ["", rootId: RawId]
 *
 * The implementation of the GhostPath is chosen to specifically support the heavy needs of
 * getObjectField/getObjectTransient. The root step is a plain GhostPath instance with the
 * placeholder root lookup mapping as a plain member as: step[""] = ["", rootId].
 * Each instantiation step is
 * step = Object.create(previousStep); with its lookup mapping
 * step[ghostHostPrototypeId] = [ghostHostId, ghostId];
 *
 * A ghost path can consist of three semantically different types of steps, from first ie. outermost
 * step in the path being the least instantiated step at the prototype end of the path:
 * 1. object ghost step, during object resolution: stored in transient objects as getGhostPath(id)
 *   Used to represent virtual ghosts as immutable transient objects which retain the ghost object
 *   path, but are otherwise a drop-in replacement for actual resolved objects.
 * 2. lookup prototype ghost step: during property lookup resolution, added during instance
 *   prototype forward steps (be it ghost or direct instances):
 *   ghostHostPrototypeId -> [ghostId, ghostHostId]
 * 3. lookup object ghost step: during property lookup the steps added to the ghost path from the
 *   source objects' own ghost object path.
 *   ghostHostPrototypeId -> [ghostId, ghostHostId]
 */
export default class GhostPath {
  constructor (rootId: RawId) {
    this[""] = [null, rootId];
    this[hostPrototypeRawIdKey] = "";
  }

  isInherited (): boolean { return this[this[hostPrototypeRawIdKey]][0] !== null; }

  isRoot (): boolean {
    return this[hostPrototypeRawIdKey] === "";
  }

  isGhost (): boolean {
    const entry = this[this[hostPrototypeRawIdKey]];
    return (entry[0] !== null) && (entry[0] !== entry[1]);
  }

  isInstance (): boolean {
    const entry = this[this[hostPrototypeRawIdKey]];
    return entry[0] === entry[1];
  }


  rootRawId (): RawId {
    return this[""][1];
  }

  headRawId (): RawId {
    return this[this[hostPrototypeRawIdKey]][1];
  }

  headHostRawId (): RawId {
    return this[this[hostPrototypeRawIdKey]][0];
  }

  headHostPrototypeRawId (): RawId {
    return this[hostPrototypeRawIdKey];
  }

  /**
   * @returns the whole GhostPath object at previous step or null if
   * this is the first step.
   */
  previousGhostStep (): ?GhostPath {
    if (!this.isGhost()) return undefined;
    return Object.getPrototypeOf(this);
  }

  previousPrototypeStep (): ?GhostPath {
    if (this.isRoot()) return undefined;
    return Object.getPrototypeOf(this);
  }

  getGhostHostAndObjectRawIdByHostPrototype (hostPrototypeRawId: RawId): [RawId, RawId] {
    return this[hostPrototypeRawId];
  }

  getHostRawIdByHostPrototype (hostPrototypeRawId: RawId): RawId {
    const ret = this[hostPrototypeRawId];
    return ret && ret[0];
  }

  getInstanceStepByHostPrototype (hostPrototypeRawId: RawId): RawId {
    const ret = this[hostPrototypeRawId];
    return ret && ret[2];
  }

  /**
   * Returns a new GhostPath with a new step with given parameters added to this GhostPath.
   *
   * @param {RawId} ghostHostPrototypeId
   * @param {RawId} ghostHostId
   * @param {RawId} explicitGhostId      overriding ghost id: use with caution. A lot of the
   *                                      systems expect the ghost ids to be deterministic, which is
   *                                      the default behaviour if explicitGhostId is omitted.
   * @returns
   */
  withNewStep (ghostHostPrototypeId: RawId, ghostHostId: RawId, explicitGhostId: RawId):
      GhostPath {
    invariantifyString(ghostHostPrototypeId, "withNewStep.ghostHostPrototypeId");
    invariantifyString(ghostHostId, "withNewStep.ghostHostId");
    invariantifyString(explicitGhostId, "withNewStep.explicitGhostId");
    const ret = Object.create(this);
    ret[ghostHostPrototypeId] = [ghostHostId, explicitGhostId, ret];
    ret[hostPrototypeRawIdKey] = ghostHostPrototypeId;
    return ret;
  }

  withNewGhostStep (ghostHostPrototypeId: RawId, ghostHostId: RawId): GhostPath {
    return this.withNewStep(ghostHostPrototypeId, ghostHostId,
        createGhostRawId(this.headRawId(), ghostHostId));
  }

  withNewInstanceStep (instanceRawId: RawId) {
    return this.withNewStep(this.headRawId(), instanceRawId, instanceRawId);
  }

  toURIString (): string {
    const json = this.toJSON();
    let ret = json[0];
    for (const step of json.slice(1)) {
      if (typeof step === "string") ret = step;
      else ret = `${encodeURIComponent(step[1])}/@:${ret}`;
    }
    return ret;
  }

  toString (): string {
    const json = this.toJSON();
    return `path(${json.slice(1).reduce((accum, step) => (typeof step === "string"
        ? `'${step}'=|>${accum}`
        : `'${step[2]}'-@('${step[1]}'=|>'${step[0]}')-|>${accum}`
    ), `'${json[0]}'`)})`;
  }

  toBriefJSON (): JSONGhostStep {
    const hostPrototypeId = this.headHostPrototypeRawId();
    if (!hostPrototypeId) return this.headRawId();
    const hostAndId = this[hostPrototypeId];
    if (hostAndId[0] === hostAndId[1]) return hostAndId[0];
    return [hostPrototypeId, hostAndId[0], hostAndId[1]];
  }

  toJSON (): JSONGhostPath {
    const previous = this.previousPrototypeStep();
    const ret = previous ? previous.toJSON() : [];
    ret.push(this.toBriefJSON());
    return ret;
  }

  static _elevationCacheSymbol = Symbol("GhostPath.elevationCache");

  /**
   * Returns the weakly cached or if not one is not found, a new GhostElevation object which has
   * the given *instancePath* set and this path as its *basePath*.
   *
   * @param {GhostPath} instancePath
   * @returns {GhostElevation}
   *
   * @memberof GhostPath
   */
  obtainGhostElevation (instancePath: GhostPath): GhostElevation {
    const elevationCache = !this.hasOwnProperty(GhostPath._elevationCacheSymbol)
        ? this[GhostPath._elevationCacheSymbol] = new WeakMap()
        : this[GhostPath._elevationCacheSymbol];
    let elevation = elevationCache.get(instancePath);
    if (!elevation) {
      elevationCache.set(instancePath, (elevation = new GhostElevation(this, instancePath)));
    }
    return elevation;
  }

  /**
   * Clears all elevation lookup entries for given elevation instance path.
   * Typically as a response to the instance being destroyed.
   *
   * @param {RawId} contextRawId
   */
  removeGhostElevation (instancePath: GhostPath) {
    if (this._elevationCache) this._elevationCache.delete(instancePath);
  }
}

/**
 * GhostElevation represents the mapping from references owned by some *base* Resource into
 * corresponding references in the context of some specific (direct or nested) *instance* of the
 * *base* Resource.
 *
 * The *instance* resource has the *base* resource somewhere in its ghost path. The elevation
 * The ElevationPath is then defined to be the ghost path steps from the *owner* resource to the
 * *context* resource.
 *
 * All elevations and elevated ids are keyed weakly by GhostPath. This is so that all cached
 * elevated id's will be flushed if there are prototype chain changes.
 *
 * Rationale for the need for the cache:
 * 1. This process is extremely common. Practically every field lookup involves this step.
 * 2. This process is also relatively expensive. Even a single elevation step involves the
 * generation of a ghost id with strict uniqueness and determinism constraints.
 *
 * @export
 * @class Elevation
 */
export class GhostElevation {
  basePath: GhostPath;
  instancePath: GhostPath;

  _elevatedIds: WeakMap<GhostPath, any>;

  constructor (basePath: GhostPath, instancePath: GhostPath) {
    this.basePath = basePath;
    this.instancePath = instancePath;
    this._elevatedIds = new WeakMap();
  }

  toString () {
    return `Elevation(${this.instancePath.toString()} <=||= ${this.basePath.toString()}`;
  }

  getElevatedIdOf (pathInBaseContext: GhostPath) {
    return this._elevatedIds.get(pathInBaseContext);
  }

  setElevatedIdOf (pathInBaseContext: GhostPath, idInInstanceContext: any) {
    this._elevatedIds.set(pathInBaseContext, idInInstanceContext);
  }
}

export function ghostPathFromJSON (json: JSONGhostPath): GhostPath {
  return json.slice(1).reduce((accum, step) => {
    if (typeof step === "string") return accum.withNewInstanceStep(step);
    return accum.withNewGhostStep(...step);
  }, new GhostPath(json[0]));
}
