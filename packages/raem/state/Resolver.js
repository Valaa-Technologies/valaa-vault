// @flow

import { GraphQLSchema } from "graphql/type";

import ValaaReference, { VRef, vRef, obtainVRef, tryCoupledFieldFrom } from "~/raem/ValaaReference";
import type { JSONIdData, IdData, RawId,  } from "~/raem/ValaaReference"; // eslint-disable-line no-duplicate-imports
import type ValaaURI from "~/raem/ValaaURI";

import GhostPath from "~/raem/state/GhostPath";
import Transient, { createImmaterialTransient, createInactiveTransient }
    from "~/raem/state/Transient";
import type { State } from "~/raem/state/State";
import type { FieldInfo } from "~/raem/state/FieldInfo";

import { tryHostRef } from "~/raem/VALK/hostReference";

import { dumpObject, invariantify, invariantifyObject, invariantifyString, LogEventGenerator }
    from "~/tools";

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
  deserializeReference: (idData: IdData, originatingPartitionURI?: ValaaURI) => VRef;

  constructor (options: ?Object) {
    if (!options.name) options.name = "Resolver";
    super(options);
    this.state = options.state;
    this.schema = options.schema;
    if (!(this.schema instanceof GraphQLSchema)) {
      invariantifyObject(this.schema, `${this.getName()}.schema`, { instanceof: GraphQLSchema });
    }
  }

  schema: GraphQLSchema;

  obtainReference (params, originatingPartitionURI: ?ValaaURI) {
    return params
        && (tryHostRef(params)
            || (this._deserializeReference
                && this._deserializeReference(params, originatingPartitionURI))
            || obtainVRef(params, undefined, undefined, originatingPartitionURI || undefined));
  }

  setDeserializeReference (deserializeReference: Function) {
    this._deserializeReference = deserializeReference;
  }

  getSchema () { return this.schema; }
  getTypeIntro (typeName: string) {
    return this.schema.getType(typeName);
  }

  state: State;

  getState () { return this.state; }

  setState (state: State) {
    if (!state) invariantify(state, "state must be truthy");
    this.state = state;
    return this;
  }

  maybeForkWithState (state: ?State) {
    return !state || (state === this.state) ? this : Object.create(this).setState(state);
  }

  // object section
  objectTypeName: ?string;

  setObject (id: VRef, typeName: string) {
    this.objectId = id;
    this.objectTypeName = typeName;
  }

  tryStateTransient (rawId: string, typeName: string): Transient {
    let transientCandidate = this.state.getIn([typeName, rawId]);
    if (typeof transientCandidate === "string") {
      this.objectTypeName = transientCandidate;
      transientCandidate = this.state.getIn([transientCandidate, rawId]);
    }
    return transientCandidate;
  }

  /**
   * Returns a bound id-VRef object. Bound id means that the id VRef
   * object is retrieved from an existing resource 'id' property.
   * Binding gives three benefits:
   *
   * 1. it validates that the referred resource actually exists within
   *    the Corpus
   * 2. for commands going upstream the correct partition URI is made
   *    available
   * 3. it applies flyweight pattern on the non-trivial id VRef
   *    construct, improving performance
   *
   * Step 1. is pre-validation for upstream commands, but also serves
   * the purpose of catching corrupted events coming downstream from
   * the backend, offering an opportunity for escalating diagnostics
   * alarms.
   *
   * The mapping [corpus, rawId] -> id-VRef is unique (within single
   * state, see below), so VRef equality comparisons between bound id's
   * in the context of the corpus can use strict object equality. Note
   * that this only applies to id-VRef, ie. VRef's with undefined
   * coupledField.
   *
   * TODO(iridian): modify/construct variants/destroy don't actually
   * use bindObjectId but have their custom processes relying on
   * goToTransientOfRawId directly. This duplicate logic could be
   * simplified.
   *
   * @param {JSONIdData} id             serialized JSONIdData or plain VRef
   * @returns {VRef}
   */
  bindObjectId (objectId: VRef, typeName: string): VRef {
    const rawId = objectId.rawId();
    try {
      let object = this.tryStateTransient(rawId, typeName);
      if (!object) {
        // Ghost, inactive or fail
        object = Object.create(this).tryGoToTransient(objectId, typeName, false, false);
        if (!object) {
          invariantify(object, `Can't find ${rawId}:${typeName} in corpus`,
              "\n\twhile trying to bind id:", objectId);
        }
      }
      const boundId = object.get("id");
      if (boundId.isInactive() && !boundId.getPartitionURI() && objectId.getPartitionURI()) {
        // TODO(iridian): Refactor the object id partitionURI management. The thing that's going on
        // here is that inactive object stubs which originate from ghost paths don't have
        // partitionURI's specified because ghost path entries don't have them. Instead the
        // partitionURI must be sourced from the actual "prototype" field of the topmost instance.
        boundId.setPartitionURI(objectId.getPartitionURI());
      }
      return boundId;
    } catch (error) {
      throw this.wrapErrorEvent(error, `bindObjectId(${rawId}:${typeName})`,
          "\n\tid:", ...dumpObject(objectId),
          "\n\tResolver:", this);
    }
  }

  bindObjectRawId (rawId: string, typeName: string, contextPartitionURI?: ValaaURI) {
    return this.bindObjectId(vRef(rawId, undefined, undefined, contextPartitionURI), typeName);
  }

  bindObjectIdData (idData: IdData, typeName: string, contextPartitionURI?: ValaaURI) {
    return this.bindObjectId(this.obtainReference(idData, contextPartitionURI), typeName);
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
  bindFieldVRef (fieldRef: VRef | JSONIdData, fieldInfo: FieldInfo,
      contextPartitionURI?: ValaaURI) {
    const coupledField = fieldInfo.coupledField
        || tryCoupledFieldFrom(fieldRef)
        || fieldInfo.defaultCoupledField;
    const boundId = this.bindObjectIdData(fieldRef, "TransientFields", contextPartitionURI);
    return !coupledField ? boundId : boundId.coupleWith(coupledField);
  }

  objectTransient: Transient;
  objectId: VRef;

  goToTransient (id: VRef, typeName: string) {
    return this.tryGoToTransient(id, typeName, true, false);
  }

  tryGoToNonGhostTransient (id: VRef, typeName: string) {
    return this.tryGoToTransient(id, typeName, false, true);
  }

  goToNonGhostTransient (id: VRef, typeName: string) {
    return this.tryGoToTransient(id, typeName, true, true);
  }

  /**
   * tryGoToTransientOfRawId resolves a transient based on given
   * objectId and typeName.
   * this.objectId will be assigned the id of this transient.
   * If the requested resource is an immaterialized ghost then an
   * immaterialized temporary transient is created for it.
   *
   * @param {RawId} rawId
   * @param {string} [typeName]
   * @returns
   * @memberof Resolver
   */
  tryGoToTransient (objectId: VRef, typeName: string, require: ?boolean,
      nonGhostLookup: ?boolean, onlyMostMaterialized?: any, withOwnField?: string) {
    try {
      if (typeof typeName !== "string") {
        invariantifyString(typeName, "tryGoToTransient.typeName");
      }
      if (!(objectId instanceof ValaaReference)) {
        if (objectId || require) {
          throw new Error("tryGoToTransient.objectId must be a valid ValaaReference");
        }
        this.objectId = null;
        this.objectTypeName = null;
        return (this.objectTransient = null);
      }
      this.tryGoToTransientOfRawId(objectId.rawId(), typeName,
          require && withOwnField, // only require with withOwnField, otherwise post-process locally
          nonGhostLookup ? undefined : objectId.tryGhostPath(), onlyMostMaterialized, withOwnField);
      if (!this.objectTransient && !withOwnField) {
        this.objectId = this.tryBindToInactivePartitionObjectId(objectId, typeName);
        this.objectTypeName = this.schema.inactiveType.name;
        if (this.objectId) {
          this.objectTransient = createInactiveTransient(this.objectId);
        } else if (require) {
          throw new Error(`Could not resolve non-ghost, non-inactive object '${
              objectId}:${this.objectTypeName}'`);
        }
      }
      return this.objectTransient;
    } catch (error) {
      throw this.wrapErrorEvent(error, "tryGoToTransient",
          "\n\tid:", ...dumpObject(objectId), ":", typeName,
          "\n\trequire:", require, ", nonGhostLookup:", nonGhostLookup);
    }
  }

  goToTransientOfRawId (rawId: RawId, typeName?: string, ghostPath?: GhostPath) {
    return this.tryGoToTransientOfRawId(rawId, typeName, true, ghostPath);
  }

  /**
   * tryGoToTransientOfRawId resolves a transient based on given rawId and
   * typeName and then it to this.objectTransient.
   * this.objectId will be assigned the id of this transient.
   * If the requested resource is an immaterialized ghost then an
   * immaterialized temporary transient is created for it.
   *
   * @param {RawId} rawId
   * @param {string} [typeName]
   * @returns
   * @memberof Resolver
   */
  tryGoToTransientOfRawId (rawId: RawId, typeName?: string, require?: boolean = false,
      ghostPath?: GhostPath, onlyMostMaterialized?: any, withOwnField?: string) {
    try {
      if (typeName) this.objectTypeName = typeName;
      this.objectTransient = this.tryStateTransient(rawId, this.objectTypeName);
      if (this.objectTransient && (!withOwnField || this.objectTransient.has(withOwnField))) {
        this.objectId = this.objectTransient.get("id");
      } else if (!ghostPath || ghostPath.isRoot()
          || !this.goToMostInheritedMaterializedTransient(ghostPath, require, withOwnField)) {
        // Concrete resource or a ghost resource with its base
        // prototype in an inactive partition or outright missing.
        this.objectId = null;
        this.objectTransient = null;
      } else if (onlyMostMaterialized || withOwnField) {
        // A most inherited materialized transient or withOwnField was
        // found but its id naturally is not the rawId that was passed
        // in but instead the id of the matching prototype.
        // Clear objectId to denote that.
        this.objectId = null;
      } else {
        // Create an immaterial transient which inherits from the most
        // inherited materialized transient
        this.objectTransient = createImmaterialTransient(rawId, ghostPath, this.objectTransient);
        this.objectId = this.objectTransient.get("id");
      }
      if (!this.objectTransient && require) {
        throw new Error(`Could not find non-ghost resource '${rawId}:${this.objectTypeName}'`);
      }
      return this.objectTransient;
    } catch (error) {
      throw this.wrapErrorEvent(error,
          `goToTransientOfRawId(${rawId}:${this.objectTypeName}/${String(ghostPath) || ""})`,
          "\n\trequire:", require,
          "\n\tghostPath:", String(ghostPath),
          "\n\tthis:", this,
      );
    }
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
    if (typeName === "Blob") return this.obtainReference(id);
    return undefined;
  }

  /**
   * Resolves the outermost materialized ghost transient and sets it as
   * this.objectTransient, based on given currentPath.
   * Returns the full top-level ghost path which has been rebased on
   * top of the materialized transient ghost path.
   * If no materialized ghost prototype is found returns undefined
   * if require is not, otherwise throws an error.
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
        const transient = this.tryStateTransient(rawId, this.objectTypeName);
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
