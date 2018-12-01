// @flow

import { GraphQLSchema } from "graphql/type";

import { VRef, invariantifyId, obtainVRef, tryCoupledFieldFrom }
    from "~/raem/ValaaReference";
import type { JSONIdData, IdData, RawId } from "~/raem/ValaaReference"; // eslint-disable-line no-duplicate-imports

import GhostPath from "~/raem/state/GhostPath";
import Transient, { createImmaterialTransient, createInactiveTransient }
    from "~/raem/state/Transient";
import type { State } from "~/raem/state/State";

import { tryHostRef } from "~/raem/VALK/hostReference";


import { dumpObject, invariantify, invariantifyString, LogEventGenerator } from "~/tools";

type BindFieldVRefOptions = {
  coupledField?: string, defaultCoupledField?: string, bindPartition?: boolean,
};

/**
 * Resolver is a very low-level component for performing various
 * resolutions against a specific known state.
 *
 * Three main types of resolutions are:
 * 1. resolving ValaaReference's (VRef's) to find corresponding
 *    Transient's from the state
 * 2. binding external, possibly serialized VRef data to existing VRef
 *    objects with the same identity in the state
 * 3. resolving Transient field lookups, including ghost elevation
 *    proceduce
 *
 * All references in corpus state must be VRef's, and those VRef's must
 * be bound, meaning that the same conceptual reference uses the same
 * object and can thus be compared with '==='.
 * Binding means that before storing their target Transient is looked
 * up, and the VRef is replaced with that of the transient "id" field
 * (with appropriate coupledField). This enables both internal
 * consistency (no invalid references to void) as well as better
 * performance.
 *
 * @export
 * @class Resolver
 */
export default class Resolver extends LogEventGenerator {
  constructor (options: ?Object) {
    if (!options.name) options.name = "Resolver";
    super(options);
    this.state = options.state;
    this.schema = options.schema;
  }

  schema: GraphQLSchema;

  getSchema () { return this.schema; }
  getTypeIntro (typeName: string) {
    return this.schema.getType(typeName);
  }

  state: State;

  getState () { return this.state; }

  setState (state: State) {
    invariantify(state, "state must be truthy");
    this.state = state;
  }

  // object section
  typeName: ?string;

  setTypeName (typeName: string) {
    this.typeName = typeName;
    invariantifyString(this.typeName, "Resolver.typeName");
  }

  /**
   * Returns a bound id-VRef object. Bound id means that the id VRef object is retrieved
   * from an existing resource 'id' property. Binding gives three benefits:
   *
   * 1. it validates that the referred resource actually exists within the Corpus
   * 2. for commands going upstream the correct partition URI is made available
   * 3. it applies flyweight pattern on the non-trivial id VRef construct, improving performance
   *
   * Step 1. is pre-validation for upstream commands, but also serves the purpose of catching
   * corrupted events coming downstream from the backend, offering an opportunity for escalating
   * diagnostics alarms.
   *
   * The mapping [corpus, rawId] -> id-VRef is unique (within single state, see below), so VRef
   * equality comparisons between bound id's in the context of the corpus can use strict object
   * equality. Note that this only applies to id-VRef, ie. VRef's with undefined coupledField.
   *
   * TODO(iridian): modify/construct variants/destroy don't actually use bindObjectId but have
   * their custom processes relying on goToTransientOfRawId directly. This duplicate logic
   * could be simplified.
   *
   * @param {JSONIdData} id             serialized JSONIdData or plain VRef
   * @returns {VRef}
   */
  bindObjectId (objectId: any, typeName: string = "Resource", bindPartition?: boolean): VRef {
    const id = tryHostRef(objectId) || obtainVRef(objectId);
    const rawId = id.rawId();
    try {
      let object = this.state.getIn([typeName, rawId]);
      if (typeof object === "string") object = this.state.getIn([object, rawId]);
      if (!object) {
        // Ghost, inactive or fail
        object = this.fork().resolveToTransientOf(rawId, id.tryGhostPath(), typeName, false, false);
      }
      invariantify(object, `Can't find ${rawId}:${typeName} in corpus`,
          "\n\twhile trying to bind id:", id);
      const boundId = object.get("id");
      if (boundId.isInactive() && !boundId.getPartitionURI() && id.getPartitionURI()) {
        // TODO(iridian): Refactor the object id partitionURI management. The thing that's going on
        // here is that inactive object stubs which originate from ghost paths don't have
        // partitionURI's specified because ghost path entries don't have them. Instead the
        // partitionURI must be sourced from the actual "prototype" field of the topmost instance.
        boundId.setPartitionURI(id.getPartitionURI());
      }
      return (!bindPartition || !boundId.isGhost())
          ? boundId
          : boundId.immutatePartitionURI(
              this.fork().bindObjectId(boundId.getGhostPath().headHostRawId()).getPartitionURI());
    } catch (error) {
      throw this.wrapErrorEvent(error, `bindObjectId(${rawId}:${typeName})`,
          "\n\tid:", ...dumpObject(id),
          "\n\tResolver:", this);
    }
  }

  /**
   * Returns a bound field-VRef object.
   * Similar to bindObjectId but sets the coupled field name for the returned field-VRef based
   * on given options and the given fieldRef.
   * Note that the mapping [corpus, rawId, coupledField] -> [fieldVRef1, fieldVRef2, ...] is not
   * unique so field VRef comparisons cannot be done using strict object equality.
   *
   * TODO(iridian): Add convenience for retrieving the associated id-VRef from a field-VRef.
   *
   * The rules for determining the coupled field:
   * 1. options.coupledField
   * 2. ref.coupledField
   * 3. options.defaultCoupledField
   * 4. null - the bound id reference is used directly
   *
   *
   * @param {JSONIdData} id
   * @param {any} [{ coupledField, defaultCoupledField }={}]    accepts a fieldInfo structure
   * @returns
   */
  bindFieldVRef (fieldRef: VRef | JSONIdData, options: BindFieldVRefOptions = {}) {
    const coupledField = options.coupledField || tryCoupledFieldFrom(fieldRef)
        || options.defaultCoupledField;
    const boundId = this.bindObjectId(fieldRef, undefined, options.bindPartition);
    return !coupledField ? boundId : boundId.coupleWith(coupledField);
  }

  objectTransient: Transient;
  objectId: VRef;

  tryGoToTransientOfRef (id: VRef, typeName: string, require: ?boolean, nonGhostLookup: ?boolean) {
    if (!(id instanceof VRef)) {
      throw new Error("INTERNAL ERROR: tryGoToTransientOfRef.id is not a ValaaReference");
    }
    return this.resolveToTransientOf(id.rawId(), id.tryGhostPath(), typeName, require, nonGhostLookup);
  }

  goToTransientOfRef (id: VRef, typeName: string) {
    if (!(id instanceof VRef)) {
      throw new Error("INTERNAL ERROR: goToTransientOfRef.id is not a ValaaReference");
    }
    return this.resolveToTransientOf(id.rawId(), id.tryGhostPath(), typeName, true, false);
  }

  tryGoToNonGhostTransientOfRef (id: VRef, typeName: string) {
    if (!(id instanceof VRef)) {
      throw new Error("INTERNAL ERROR: tryGoToNonGhostTransientOfRef.id is not a ValaaReference");
    }
    return this.resolveToTransientOf(id.rawId(), id.tryGhostPath(), typeName, false, true);
  }

  goToNonGhostTransientOfRef (id: VRef, typeName: string) {
    if (!(id instanceof VRef)) {
      throw new Error("INTERNAL ERROR: goToNonGhostTransientOfRef.id is not a ValaaReference");
    }
    return this.resolveToTransientOf(id.rawId(), id.tryGhostPath(), typeName, true, true);
  }

  resolveToTransientOf (rawId: string, ghostPath: ?GhostPath, typeName: string, require: boolean,
      nonGhostLookup: boolean, onlyMostMaterialized?: any, withOwnField?: string) {
    invariantifyString(rawId, "resolveToTransientOf.rawId");
    invariantifyString(ghostPath, "resolveToTransientOf.ghostPath",
        { allowUndefined: true, instanceOf: GhostPath });
    invariantifyString(typeName, "resolveToTransientOf.typeName");
    /*
    this.objectId = id;
    if (!this.objectId) {
      if (!require) return (this.objectTransient = null);
      invariantifyId(id, "resolveToTransientOf.id must be valid ValaaReference");
    }
    */
    const ret = this.tryGoToTransientOfRawId(rawId, typeName, false,
        nonGhostLookup ? undefined : ghostPath, onlyMostMaterialized, withOwnField);
    if (ret) return ret;
    this.objectId = withOwnField ? undefined
        : this.tryBindToInactivePartitionObjectId(id, typeName);
    if (this.objectId) {
      this.objectTransient = createInactiveTransient(this.objectId);
    } else if (require) {
      throw new Error(`Could not resolve non-ghost, non-inactive object '${id}:${this.typeName}'`);
    }
    return this.objectTransient;
  }

  goToTransientOfRawId (rawId: RawId, typeName?: string) {
    return this.tryGoToTransientOfRawId(rawId, typeName, true);
  }

  tryGoToTransientOfRawId (rawId: RawId, typeName?: string, require?: boolean = false,
      ghostPath?: GhostPath, onlyMostMaterialized?: any, withOwnField?: string) {
    try {
      if (typeName) this.setTypeName(typeName);
      this.objectTransient = this.getTransientFromTypeTable(rawId);
      if (this.objectTransient && (!withOwnField || this.objectTransient.has(withOwnField))) {
        this.objectId = this.objectTransient.get("id");
      } else if (!ghostPath || ghostPath.isRoot()) {
        this.objectTransient = null;
        if (require) throw new Error(`Could not find non-ghost object '${rawId}:${this.typeName}'`);
      } else if (!this.goToMostInheritedMaterializedTransient(ghostPath, require, withOwnField)) {
        this.objectId = withOwnField
            ? undefined : this.tryBindToInactivePartitionObjectId(ghostPath, withOwnField);
        this.objectTransient = null;
      } else if (onlyMostMaterialized || withOwnField) {
        // A most inherited materialized transient or withOwnField was
        // found but its id naturally is not the requested rawId so we
        // clear objectId to denote that.
        this.objectId = null;
      } else {
        this.objectTransient = createImmaterialTransient(rawId, ghostPath, this.objectTransient);
        this.objectId = this.objectTransient.get("id");
      }
      return this.objectTransient;
    } catch (error) {
      throw this.wrapErrorEvent(error,
          `goToTransientOfRawId(${rawId}:${this.typeName}/${String(ghostPath) || ""})`,
          "\n\trequire:", require,
          "\n\tghostPath:", String(ghostPath),
          "\n\tthis:", this,
      );
    }
  }

  getTransientFromTypeTable (rawId: string): Transient {
    let transientCandidate = this.state.getIn([this.typeName, rawId]);
    if (typeof transientCandidate === "string") {
      this.typeName = transientCandidate;
      transientCandidate = this.state.getIn([this.typeName, rawId]);
    }
    return transientCandidate;
  }

  tryBindToInactivePartitionObjectId (id: IdData, typeName: string) {
    // TODO(iridian): This function should make sure that the id refers to an _inactive_ partition.
    // if the id is part of an active partition but still missing from corpus, that's a violation.
    const ref = tryHostRef(id);
    if (ref) {
      const partitionURI = ref.getPartitionURI();
      if (partitionURI) {
        ref.setInactive();
        /*
        this.info("tryBindToInactivePartitionObjectId: bound an id (with partitionURI) as inactive",
            "id, without checking whether that partition is actually active (which'd be an error)",
            "<details suppressed to enable browser log collapsing>",
            // dumpify(id.toJSON()), id,
        );
        */
        // FIXME(iridian): This is a quick hack! We need to have active partition resolution logic
        // and object stubbing for referred but otherwise inactive resources.
        return id;
      }
    }
    if (typeName === "Blob") return obtainVRef(id);
    return undefined;
  }

  /**
   * Resolves the outermost materialized ghost transient and sets it as this.objectTransient,
   * based on given currentPath.
   * Returns the full top-level ghost path which has been rebased on top of the materialized
   * transient ghost path.
   *
   * @export
   * @param {Resolver} resolver
   * @param {GhostPath} currentPath
   * @param {GhostPath} withOwnField - require transient to have this field for it to be considered
   *                                   a match
   * @returns {GhostPath} the transient ghostPath
   */
  goToMostInheritedMaterializedTransient (ghostPath: GhostPath, require: boolean = true,
      withOwnField?: string): GhostPath {
    let nextStep = ghostPath;
    let currentPath;
    try {
      while (true) { // eslint-disable-line no-constant-condition
        currentPath = nextStep.previousStep();
        if (!currentPath) {
          if (!require) return undefined;
          throw new Error(`GhostPath beginning reached without finding a materialized ghost ${
              ""}or concrete object`);
        }
        const rawId = currentPath.headRawId();
        const transient = this.getTransientFromTypeTable(rawId);
        if (transient && (!withOwnField || transient.get(withOwnField))) {
          this.objectTransient = transient;
          const transientId = transient.get("id");
          const transientGhostPath = transientId.getGhostPath();
          if (currentPath !== transientGhostPath) {
            // Rebase nextStep (which is a generated ghost path) on top of a persisted ghost path.
            Object.setPrototypeOf(nextStep, transientGhostPath);
          }
          return transientId;
        }
        nextStep = currentPath;
      }
    } catch (error) {
      throw this.wrapErrorEvent(error, `goToMostInheritedMaterializedTransient`,
          "\n\tghostPath:", ghostPath,
          "\n\tcurrentPath:", currentPath,
          "\n\twithOwnField:", withOwnField);
    }
  }
}
