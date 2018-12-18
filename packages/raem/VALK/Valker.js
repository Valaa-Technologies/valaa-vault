// @flow

import { Iterable, OrderedMap } from "immutable";
import { GraphQLSchema, GraphQLObjectType } from "graphql/type";

import ValaaReference, { isIdData } from "~/raem/ValaaReference";

import { elevateFieldReference, elevateFieldRawSequence }
    from "~/raem/state/FieldInfo";
import { getObjectRawField } from "~/raem/state/getObjectField";
import Resolver from "~/raem/state/Resolver";
import Transient, { tryTransientTypeName, PrototypeOfImmaterialTag }
    from "~/raem/state/Transient";

import { MissingPartitionConnectionsError } from "~/raem/tools/denormalized/partitions";

import raemBuiltinSteppers, { debugWrapBuiltinSteppers } from "~/raem/VALK/builtinSteppers";
import Kuery, { dumpKuery, dumpScope, dumpObject } from "~/raem/VALK/Kuery";
import { tryHostRef } from "~/raem/VALK/hostReference";
import { tryPackedField, packedSingular } from "~/raem/VALK/packedField";
import { addStackFrameToError, SourceInfoTag } from "~/raem/VALK/StackTrace";
import isInactiveTypeName from "~/raem/tools/graphql/isInactiveTypeName";

import type Logger from "~/tools/Logger";
import { dumpify, isSymbol, wrapError } from "~/tools";

export type Packer = (unpackedValue: any, valker: Valker) => any;
export type Unpacker = (packedValue: any, valker: Valker) => any;

// VALKOptions ownership is always given to callee. If you wish to retain the original unchanged
// pass the options to the callee with Object.create(options).
// As a rule of thumb, you should wrap _all but last_ call that takes a specific options like this.
export type VALKOptions = {
  scope?: Object,
  state?: Object,
  schema?: Object,
  verbosity?: number,
  typeName?: string,
  pure?: boolean,
  packFromHost?: Packer,
  unpackToHost?: Unpacker,
  builtinSteppers?: Object,
  coupledField?: string,
};

/**
 * FIXME(iridian): this doc is a bit stale.
 * run - runs the given kuery starting rom given head using given corpus.
 * valk rules as simplified pseudocode, first matching rule is picked for each individual valk step:
 *   valk (undefined | null, undefined) => raise error     // not-null raise
 *   valk (head, undefined) => head                        // not-null identity
 *   valk (head, null) => head                             // identity rule
 *
 *   valk (head, step: Function) => step(head)             // function rule
 *   valk (head, step: Object) => select(head, step)       // select rule
 *   valk (head, step: any[]) => reduce(head, kuery)       // path rule: reduce against head
 *
 *   valk (head, step: string) => head[step]               // access rule
 *   valk (head, step: number) => head[step]               // access rule
 *
 *   map (container, step) =>
 *     container.map(entry => reduce(entry, step)).filter(v => (v !==  undefined))
 *
 *   reduce(head, reduceSteps: array) =>
 *     reduceSteps.reduce((midPoint, reductionStep) => valk(midPoint, reductionStep)), head)
 * @export
 * @param {any} {
 *   head, kuery, scope, corpus, state, packFromHost, verbosity
 * }
 * @returns
 */
export function run (head: any, kuery: any, options: Object = {}) {
  return (new Valker(options.schema, options.verbosity, options.logger, options.packFromHost,
          options.unpackToHost, options.builtinSteppers))
      .run(head, kuery, options);
}

/**
 * Persistent kuery engine against state
 *
 * @export
 * @class Valker
 */
export default class Valker extends Resolver {
  constructor (schema: GraphQLSchema, verbosity: number = 0, logger: Logger, packFromHost?: Packer,
      unpackToHost?: Unpacker, builtinSteppers?: Object) {
    super({ schema, logger });
    this._indent = verbosity - 2;
    this.setHostValuePacker(packFromHost);
    this.setHostValueUnpacker(unpackToHost);
    this.setBuiltinSteppers(builtinSteppers);
  }

  static identityPacker (value: any) { return value; }
  static identityUnpacker (value: any) { return value; }

  _builtinSteppers: Object = raemBuiltinSteppers;

  /**
   * Sets the callback to pack unpacked input values into packed VALK objects when there's no direct
   * conversion.
   *
   * Input values cover all following data made available to Valker:
   * 1. kuery head
   * 2. values accessed directly from scope
   * 3. property accesses in plain objects or arrays (which are provided as head or through scope)
   * 4. return values from host step calls
   * 5. non-primitive literal values as part of kueries
   *
   * @param {any} packFromHost
   */
  setHostValuePacker (packFromHost?: Packer) {
    this._packFromHost = packFromHost || this.constructor.identityPacker;
  }

  /**
   * Sets the callback to unpack packed VALK values into unpacked output values when there's no
   * direct conversion.
   *
   * Output values are all values returned from or modified by Valker:
   * 1. kuery return value
   * 2. values modified inside scope
   * 3. property modifies in plain objects or arrays (which are provided as head or through scope)
   * 4. host step call arguments
   * 5. specific builtin operands (typeof, instanceof, ==, !=, ===, !==)
   *
   * @param {any} unpackToHost
   */
  setHostValueUnpacker (unpackToHost?: Unpacker) {
    this._unpackToHost = unpackToHost || this.constructor.identityUnpacker;
  }

  setBuiltinSteppers (builtinSteppers?: Object) {
    this._builtinSteppers = builtinSteppers || raemBuiltinSteppers;
  }

  run (head: any, kuery: any, { scope, state, verbosity, pure, sourceInfo }: VALKOptions = {}) {
    const valker = Object.create(this);
    if (pure !== undefined) valker.pure = pure;
    if (verbosity !== undefined) valker._indent = verbosity - 2;
    if (state !== undefined) valker.setState(state);
    if (sourceInfo !== undefined) valker._sourceInfo = sourceInfo;

    const packedHead = valker.tryPack(head);
    let kueryVAKON = kuery;

    try {
      if (kuery instanceof Kuery) {
        kueryVAKON = kuery.toVAKON();
        valker._sourceInfo = sourceInfo || kuery[SourceInfoTag];
      }

      let ret;
      if (valker._indent < -1) {
        ret = valker.tryUnpack(valker.advance(packedHead, kueryVAKON, scope));
      } else {
        if (packedHead === undefined) throw new Error("Head missing for kuery");
        const indent = valker._indent < 0 ? 0 : valker._indent;
        if (valker._indent >= 0) {
          valker._builtinSteppers = debugWrapBuiltinSteppers(valker._builtinSteppers);
          valker.log("  ".repeat(indent), `${this.debugId()}.run(verbosity: ${verbosity}), using`,
                  !state ? "intrinsic state:" : "explicit options.state:",
              "\n", "  ".repeat(indent), "      head:", ...dumpObject(packedHead),
              "\n", "  ".repeat(indent), "      kuery:", ...dumpKuery(kueryVAKON),
              "\n", "  ".repeat(indent), "      scope:", dumpScope(scope));
        }

        const packedResult = valker.advance(packedHead, kueryVAKON, scope);
        ret = valker.tryUnpack(packedResult);

        valker.log("  ".repeat(indent), `${this.debugId()}.run(verbosity: ${
                verbosity}) result, when using`,
            !state ? "intrinsic state:" : "explicit options.state:",
            "\n", "  ".repeat(indent), "      head:", ...dumpObject(packedHead),
            "\n", "  ".repeat(indent), "      kuery:", ...dumpKuery(kueryVAKON, valker._indent),
            "\n", "  ".repeat(indent), "      final scope:", dumpScope(scope),
            "\n", "  ".repeat(indent), "      result (packed):", dumpify(packedResult),
            "\n", "  ".repeat(indent), "      result:", ...dumpObject(valker.tryUnpack(packedResult,
                ({ id, typeName, value, objectGhostPath }) => ((value !== undefined)
                    ? value
                    : `{${id}:${typeName}/${dumpify(objectGhostPath)}}`))));
      }
      return ret;
    } catch (error) {
      throw wrapError(error, `During ${this.debugId()}\n .run(), with:`,
          "\n\tvalk head:", ...dumpObject(packedHead),
          "\n\tvalk kuery:", ...dumpKuery(kuery),
          "\n\tscope:", scope,
          "\n\tstate:", ...dumpObject(valker.state && valker.state.toJS()),
          "\n\tbase-state === self-state", this.state === valker.state,
          "\n\targ-state type:", typeof state);
    }
  }


  /**
   * Takes the given *step* from given *head* and returns the new head, based on the rules
   * determined by the type and contents of the step.
   *
   * Execute expects *head* to always be packed.
   * All other values (nested values in native containers, values in scope) are always unpacked.
   *
   * Following values are always considered both packed and unpacked:
   * ie. isPacked(value) && isUnpacked(value) === true:
   * 1. literals: (typeof value !== "object") || (value === null)
   * 2. native containers: Array.isArray(value) || !Object.getPrototypeOf(value)
   *    || (Object.getPrototypeOf(value) === Object.prototype)
   *
   * Following values are always considered strictly packed, they're never accepted as unpacked:
   * 3. packedSingular or packedSequence value: isPackedField(head)
   * 4. immutable-js transient: Iterable.isIterable(head)
   *
   * Following values are considered loosely packed: in themselves they're considered packed, but
   * they are accepted as unpacked inputs without implicit packing:
   *
   * 5. Valaa references: (value instanceof ValaaReference)
   *
   * All remaining values are considered strictly unpacked and Valker will try to pack them with
   * when
   * a packed value is expected.
   *
   * @param {any} head
   * @param {any} step
   * @param {any} scope
   * @param {any} nonFinalStep  if true, this step is a non-terminal path step and scope should be
   *                            updated with field access and selection keys for subsequent steps.
   * @returns
   */
  advance (head: any, step: any, scope: ?Object, nonFinalStep: ?boolean) {
    let type = typeof step;
    try {
      switch (type) {
        case "function":
          // Inline call, delegate handling to it completely, including packing and unpacking.
          return step(head, scope, this, nonFinalStep);
        case "number": // Index lookup
          return this.index(head, step, nonFinalStep ? scope : undefined);
        case "boolean": // nonNull op. nullable only makes a difference in paths.
          if (step === true && ((head === null) || (head === undefined))) {
            throw new Error(`Valk head is '${head}' at notNull assertion`);
          }
          return head;
        case "object": {
          if (step === null) return head;
          if (!isSymbol(step)) {
            const stepName = step[0];
            if (typeof stepName === "string") {
              const builtinStepper = this._builtinSteppers[stepName];
              if (typeof builtinStepper === "function") {
                type = builtinStepper.name;
                return builtinStepper(this, head, scope, step, nonFinalStep);
              }
              if (stepName[0] === "§") throw new Error(`Unrecognized builtin step ${stepName}`);
            }
            if (step instanceof Kuery) {
              throw new Error("Kuery objects must have been expanded as VAKON before valking");
            }
            if (!Array.isArray(step)) {
              type = "object";
              return this._builtinSteppers["§{}"](this, head, scope, ["§{}", step], nonFinalStep);
              // type = "select";
              // return this.select(head, step, scope, nonFinalStep);
            }
            type = "array";
            return this._builtinSteppers["§[]"](this, head, scope, step, nonFinalStep, 0);
          }
        }
        // eslint-disable-line no-fallthrough
        case "string": // Field lookup
        case "symbol":
          return this.field(head, step, nonFinalStep ? scope : undefined, undefined);
        default:
          throw new Error(`INTERNAL ERROR: Unrecognized step ${dumpify(step)}`);
      }
    } catch (error) {
      this.addVALKRuntimeErrorStackFrame(error, step);
      if (this._indent < 0) throw error;
      throw wrapError(error, `During ${this.debugId()}\n .advance(${type}), with:`,
          "\n\thead:", ...dumpObject(head),
          "\n\tkuery:", ...dumpKuery(step),
          "\n\tscope:", dumpScope(scope));
    }
  }

  field (object: Object | Transient, fieldName: string, scope: ?Object) {
    const singularTransient = this.requireTransientIfSingular(object);
    let objectTypeIntro;
    if (singularTransient) {
      objectTypeIntro = this.getObjectTypeIntro(singularTransient, object);
    }
    return this.fieldOrSelect(object, fieldName, scope, singularTransient, objectTypeIntro);
  }

  fieldOrSelect (object: Object | Transient, fieldName: string, scope: ?Object,
      singularTransient: ?Transient, objectTypeIntro: ?GraphQLObjectType) {
    let nextHead;
    let fieldInfo;
    if (this._indent >= 0) {
      this.log("  ".repeat(this._indent++), `{ field.'${fieldName}',
          head:`, ...dumpObject(object), ", scope:", dumpScope(scope));
    }
    try {
      // Test for improper head values
      if (!singularTransient) {
        // Object is a scope or a selection, not a denormalized resource.
        // Plain lookup is enough, but we must pack the result for the new head.
        if (!object || (typeof object !== "object") || Array.isArray(object) || object._sequence) {
          const description = !object ? `'${object}'`
              : Array.isArray(object) ? "array"
              : typeof object !== "object" || !object._sequence ? "non-keyed"
              : "indexable";
          throw new Error(`Cannot access ${description} head for field '${fieldName}'`);
        }
        nextHead = this.tryPack(object[fieldName]);
      } else {
        const resolvedObjectId = singularTransient.get("id");
        fieldInfo = resolvedObjectId
            ? { name: fieldName, elevationInstanceId: resolvedObjectId }
            : { ...object._fieldInfo, name: fieldName };
        nextHead = tryPackedField(
            getObjectRawField(this, singularTransient, fieldName, fieldInfo, objectTypeIntro),
            fieldInfo);
      }
      return nextHead;
    } catch (error) {
      throw wrapError(error, `During ${this.debugId()}\n .field('${fieldName}'), with:`,
          "\n\tfield head:", ...dumpObject(object),
          "\n\tnext head:", ...dumpObject(nextHead),
          "\n\tfieldInfo:", ...dumpObject(fieldInfo));
    } finally {
      if (this._indent >= 0) {
        this.log("  ".repeat(--this._indent), `} field '${fieldName}' ->`,
            ...dumpObject(nextHead),
            ", fieldInfo:", ...dumpObject(fieldInfo), "in scope:", dumpScope(scope));
      }
    }
  }

  index (container: Object, index: number, scope: ?Object) {
    if (this._indent >= 0) {
      this.log("  ".repeat(this._indent++), `{ index[${index}], head:`, ...dumpObject(container),
          ", scope:", dumpScope(scope));
    }
    let nextHead;
    try {
      if (!container || (typeof container !== "object")) {
        const description = !container ? container : "non-indexable";
        throw new Error(`head is ${description} when trying to index it with '${index
            }'`);
      }
      if (Array.isArray(container)) {
        const entry = container[index];
        nextHead = this.tryPack(entry);
        // if (scope) scope.index = index;
      } else {
        const indexedImmutable = (Iterable.isIndexed(container) && container)
            || (OrderedMap.isOrderedMap(container) && container.toIndexedSeq())
            || (container._sequence && elevateFieldRawSequence(
                this, container._sequence, container._fieldInfo, undefined,
                    this._indent >= 0 ? this._indent : undefined)
                    .toIndexedSeq());
        if (indexedImmutable) {
          const result = indexedImmutable.get(index);
          if (!container._type || container._fieldInfo.intro.isResource) nextHead = result;
          else nextHead = packedSingular(result, container._type, container._fieldInfo);
        } else {
          throw new Error(`Cannot index non-array, non-indexable container object with ${index}`);
        }
        // if (scope) scope.index = index;
      }
      return nextHead;
    } catch (error) {
      throw wrapError(error, `During ${this.debugId()}\n .index(${index}), with:",
          "\n\tindex head:`, ...dumpObject(container));
    } finally {
      if (this._indent >= 0) {
        this.log("  ".repeat(--this._indent), `} index ${index} ->`, ...dumpObject(nextHead),
            ", scope:", dumpScope(scope));
      }
    }
  }

  select (head: any, selectStep: Object, scope: ?Object) {
    if (this._indent >= 0) {
      this.log("  ".repeat(this._indent++), `selection ${dumpKuery(selectStep)[1]}`,
          ", head:", ...dumpObject(head), ", scope:", dumpScope(scope));
    }
    const nextHead = {};
    try {
      const singularTransient = this.requireTransientIfSingular(head);
      let headObjectIntro;
      if (singularTransient) {
        headObjectIntro = this.getObjectTypeIntro(singularTransient, head);
      }
      for (const key in selectStep) { // eslint-disable-line guard-for-in, no-restricted-syntax
        const step = selectStep[key];
        let result;
        try {
          result = ((typeof step === "string") || isSymbol(step))
              ? this.fieldOrSelect(head, step, undefined, singularTransient, headObjectIntro)
              : this.advance(singularTransient || head, step, scope);
          nextHead[key] = this.tryUnpack(result);
        } catch (error) {
          throw wrapError(error, `During ${this.debugId()}\n .select for field '${key}', with:`,
              "\n\tfield step:", ...dumpKuery(step),
              "\n\tresult:", ...dumpObject(result));
        }
      }
      return nextHead;
    } catch (error) {
      throw wrapError(error, `During ${this.debugId()}\n .select, with:`,
          "select head:", ...dumpObject(head),
          "selection:", ...dumpKuery(selectStep),
          "scope:", dumpScope(scope));
    } finally {
      if (this._indent >= 0) {
        this.log("  ".repeat(--this._indent), "} select ->", ...dumpObject(nextHead),
            ", scope:", dumpScope(scope));
      }
    }
  }

  getObjectTypeIntro (object: Object | Transient, possiblePackedHead: Object) {
    let typeName = tryTransientTypeName(object, this.schema);
    if (!typeName && possiblePackedHead._type && !possiblePackedHead._fieldInfo.intro.isResource) {
      typeName = possiblePackedHead._type;
    }
    const ret = typeName && this.getTypeIntro(typeName);
    if ((ret === undefined) && typeName && isInactiveTypeName(typeName)) {
      const partitionURI = object.get("id").getPartitionURI();
      throw new MissingPartitionConnectionsError(`Missing active partition connections: '${
          partitionURI.toString()}'`, [partitionURI]);
    }
    if (this._indent >= 0) {
      this.log("  ".repeat(this._indent), "getObjectTypeIntro", typeName, ...dumpObject(ret));
    }
    return ret;
  }

  pack (value: any) {
    return this._packFromHost(value, this);
  }

  unpack (value: any) {
    return this._unpackToHost(value, this);
  }

  tryPack (value: any) {
    if ((typeof value !== "object") || (value === null) || Array.isArray(value)) return value;
    const prototype = Object.getPrototypeOf(value);
    if (!prototype || prototype === Object.prototype) return value;
    // native containers are considered packed: their contents are lazily packFromHost'ed when
    // needed.
    return this._packFromHost(value, this);
  }

  tryUnpack (value: any) {
    try {
      if ((typeof value !== "object") || (value === null) || Array.isArray(value)) {
        if (this._indent >= 0) {
          this.log("  ".repeat(this._indent), "not unpacking literal/native container:",
              ...dumpObject(value));
        }
        return value;
      }
      let ret;
      const singularTransient = this._trySingularTransientFromObject(value, false);
      if (singularTransient !== undefined) {
        if (this._indent >= 0) {
          this.log("  ".repeat(this._indent), "unpacking singular:", ...dumpObject(value),
              "\n\t", "  ".repeat(this._indent), "transient:", ...dumpObject(singularTransient),
              ...(value._fieldInfo ? [
                "\n\t", "  ".repeat(this._indent), "fieldInfo:", ...dumpObject(value._fieldInfo),
              ] : []));
        }
        ret = this.unpack(singularTransient);
      } else if (value._sequence !== undefined) {
        if (this._indent >= 0) {
          this.log("  ".repeat(this._indent), "unpacking sequence:", ...dumpObject(value));
        }
        if (!value._sequence) {
          ret = value._sequence; // undefined or null
        } else {
          ret = [];
          elevateFieldRawSequence(this, value._sequence, value._fieldInfo)
          // TODO(iridian): Do we allow undefined entries in our unpacked arrays? Now we do.
              .forEach(entry => {
                const hostRef = tryHostRef(entry);
                const transient = !hostRef ? entry : this.tryGoToTransient(hostRef, value._type);
                ret.push(this.unpack(transient));
              });
        }
      } else if (Iterable.isIterable(value)) {
        // non-native packed sequence: recursively pack its entries.
        if (this._indent >= 0) {
          this.log("  ".repeat(this._indent), "unpacking non-native sequence recursively:",
              ...dumpObject(value));
        }
        ret = [];
        value.forEach(entry => { ret.push(this.tryUnpack(entry)); });
      } else {
        if (this._indent >= 0) {
          this.log("  ".repeat(this._indent), "not unpacking native container:",
              ...dumpObject(value));
        }
        ret = value;
      }
      if (this._indent >= 0) {
        this.log("  ".repeat(this._indent), "\t->", ...dumpObject(ret));
      }
      return ret;
    } catch (error) {
      throw wrapError(error, `During ${this.debugId()}\n .tryUnpack(`, value, `):`,
          "\n\tfieldInfo:", (typeof value === "object") ? value._fieldInfo : undefined);
    }
  }

  requireTransientIfSingular (value: any) {
    if ((typeof value !== "object") || (value === null)) return undefined;
    return this._trySingularTransientFromObject(value, true);
  }

  trySingularTransient (value: any) {
    if ((typeof value !== "object") || (value === null)) return undefined;
    return this._trySingularTransientFromObject(value, false);
  }

  _trySingularTransientFromObject (object: Object, require?: boolean) {
    try {
      let ret;
      let elevatedId;
      if (Iterable.isKeyed(object)) {
        ret = object;
      } else if (object instanceof ValaaReference) {
        ret = this.tryGoToTransient(object, "TransientFields", require, false);
      } else if (object._singular !== undefined) {
        if (!isIdData(object._singular)) {
          ret = object._singular;
        } else {
          elevatedId = elevateFieldReference(this, object._singular, object._fieldInfo,
              undefined, object._type, this._indent < 2 ? undefined : this._indent);
          ret = this.tryGoToTransient(elevatedId, object._type, require, false);
        }
      }
      if (this._indent >= 1) {
        this.log("  ".repeat(this._indent + 1),
                require ? "requireTransientIfSingular:" : "trySingularTransient:",
            "\n", "  ".repeat(this._indent + 1), "value:", ...dumpObject(object),
            ...(elevatedId ? [
              "\n", "  ".repeat(this._indent + 1), "elevatedId:", ...dumpObject(elevatedId)
            ] : []),
            "\n", "  ".repeat(this._indent + 1), "ret:", ...dumpObject(ret),
            "\n", "  ".repeat(this._indent + 1), "ret[PrototypeOfImmaterialTag]:",
                ...dumpObject(ret && ret[PrototypeOfImmaterialTag]));
      }
      return ret;
    } catch (error) {
      throw this.wrapErrorEvent(error,
              require ? "requireTransientIfSingular" : "trySingularTransient",
          "\n\tobject:", ...dumpObject(object),
          "\n\tstate:", this.getState(),
      );
    }
  }

  // Transaction base API stubs for systems which dont implement them.
  acquireTransaction () { return this; }
  abort () {}
  releaseTransaction () {}

  addVALKRuntimeErrorStackFrame (error: Error, vakon: any) {
    return !this._sourceInfo ? error : addStackFrameToError(error, vakon, this._sourceInfo);
  }
}
