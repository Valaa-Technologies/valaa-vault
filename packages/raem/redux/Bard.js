// @flow

import { GraphQLObjectType } from "graphql/type";
import { List, Map, OrderedMap, OrderedSet } from "immutable";

import { Action, EventBase } from "~/raem/events";

import ValaaReference from "~/raem/ValaaReference";

import { Resolver } from "~/raem/state";
import type { FieldInfo, State } from "~/raem/state"; // eslint-disable-line no-duplicate-imports
import Transient, { getTransientTypeName } from "~/raem/state/Transient";
import isResourceType from "~/raem/tools/graphql/isResourceType";

import { debugObjectType, dumpObject, invariantify, invariantifyString,
  outputCollapsedError, outputError, wrapError,
} from "~/tools";

/**
 * Bard subsystem.
 */

export type Passage = Action;
export type Story = Passage & {
  state: ?Object;
  previousState: ?Object;
};

export function getActionFromPassage (passage: Passage) {
  const ret = Object.getPrototypeOf(passage);
  if (ret === Object.prototype) return undefined;
  return ret;
}

/**
 * Bard middleware creates a 'journeyman' bard (which prototypes a
 * singleton-ish master bard) to handle an incoming event.
 *
 * The fluff: journeyman bard arrives with a story of some event and
 * recruits apprentices to flesh out the passages of the event details
 * for followers to hear. In doing so the bards use the knowledge
 * provided by the master bard (reducers, schema, logger).
 *
 * @export
 * @param {{
 *   name: any, schema: GraphQLSchema, logger: Object, subReduce: () => any
 * }} bardOptions
 * @returns
 */
export function createBardMiddleware () {
  const bardMiddleware = (grandmaster: Object) => (next: any) =>
      (event: EventBase, master: Bard = grandmaster) => {
        const journeyman = Object.create(master);
        const story = journeyman.beginStory(master, event);
        journeyman.finishStory(next(story, journeyman));
        master.updateState(journeyman.getState());
        return story;
      };
  return bardMiddleware;
}

const EMPTY_MAP = Map();

export function createBardReducer (bardOperation: (bard: Bard) => State,
    { skipPostPassageStateUpdate }: any = {}) {
  return function bardReduce (state: Map = EMPTY_MAP, action: Object) {
    // Create an apprentice from the seniorBard to handle the given action as passage.
    // If there is no seniorBard the action is the root story; use the smuggled journeyman as the
    // superior bard and the story as current passage.
    const apprentice = Object.create(this);
    apprentice.passage = action;
    try {
      apprentice.passage.apprentice = apprentice;
      let nextState = bardOperation(apprentice);
      if (!skipPostPassageStateUpdate && !apprentice._aggregatedPassages) {
        apprentice.updateState(nextState);
        nextState = apprentice.updateStateWithPassages();
      }
      return nextState;
    } catch (error) {
      if (apprentice.event.meta.isBeingUniversalized) {
        throw apprentice.wrapErrorEvent(error, `bardOperation(${apprentice.passage.type})`,
            "\n\taction:", ...dumpObject(getActionFromPassage(apprentice.passage)),
            "\n\tpassage:", ...dumpObject(apprentice.passage),
            "\n\tapprentice:", ...dumpObject(apprentice),
        );
      }
      const wrappedError = apprentice.wrapErrorEvent(error,
        `bardOperation(${apprentice.passage.type}) - sub-event IGNORED, reduction skipped`,
        "\n\taction:", ...dumpObject(getActionFromPassage(apprentice.passage)),
        "\n\tpassage:", ...dumpObject(apprentice.passage),
        "\n\tapprentice:", ...dumpObject(apprentice),
      );
      if (!this.getVerbosity()) {
        outputCollapsedError(wrappedError,
            "Exception caught during event replay reduction (corresponding sub-event IGNORED)");
      } else {
        outputError(wrappedError,
            "Exception caught during event replay reduction (corresponding sub-event IGNORED)");
      }
      return state;
    } finally {
      delete apprentice.passage.apprentice;
    }
  };
}

/**
 * Bard processes incoming truth and command events against current corpus state.
 *
 * A bard has three primary responsibilities. For each action, it:
 * 1. reduces the action against the corpus, ie. updates the corpus state based on the action
 * 2. creates a story, a convenience action which wraps the root action as its prototype
 * 3. creates a passage for each concrete and virtual sub-actions, wrapping them as prototypes
 * 4. universalizes a command by validating and updating it in-place before it's sent upstream
 *
 * A Bard object itself contains as fields:
 * 1. reducer context: .schema and ._logger
 * 2. bard context: .state, .story, .passage, .subReduce
 * 3. output data: .passages, .preCommands
 * 4. operation-specific data as operations are free to use the bard as a blackboard.
 *
 * Reduction:
 *
 * Bard reducers are reducer helper functions which take a Bard as their first parameter. They are
 * responsible for integrating the incoming actions against the given state and returning the
 * updated state.
 *
 * Stories and passages:
 *
 * A story ands its associated passage sub-actions are types of actions. They are non-persisted
 * convenience objects which are sent downstream towards the application and contain convenience and
 * book-keeping functionalities.
 * Story provides a uniform interface to all dependent information that can be computed from the
 * corpus state and the information in the action object itself, but which is non-primary and thus
 * should not be stored in the event objects themselves. This includes information such as
 * actualAdds/actualRemoves for a MODIFIED class of operations, passages lists for transactions
 * and for actions which involve coupling updates, etc.
 *
 * Event universalisation:
 *
 * FIXME(iridian): Outdated: command was renamed to whatever and universalization process was
 *                 overhauled
 *
 * A fundamental event log requirement is that it must fully reduceable in any configuration of
 * other partitions being partially or fully connected. This is called an universal playback
 * context. In this context some partition resources might remain inactive if they depend on another
 * (by definition, non-connected) partition. Even so, the event log playback must succeed in a way
 * that all other resources must not be affected but become active with up-to-date state (unless
 * they have their own dependencies).
 * But not only that, any inactive resources in the universal context must be in a state that they
 * become fully active when their dependent partitions are connected without the need for replaying
 * the original event log.
 *
 * Event objects coming in from downstream can be incomplete in the universal context.
 * For example ghost objects and their ownership relationships might depend on information that is
 * only available in their prototypes: this prototype and all the information on all its owned
 * objects can reside in another partition.
 * Event universalisation is the process where the event is extended to contain all information that
 * is needed for its playback on the universal context.
 */
export default class Bard extends Resolver {
  subReduce: Function;

  preActionState: State;
  story: Story; // Story is the top-level passage around the root action
  passage: Passage; // Passages are the individual wrappers around sub-actions

  objectTypeIntro: ?GraphQLObjectType;

  constructor (options: Object) {
    super(options);
    this.subReduce = options.subReduce;
  }

  debugId () {
    const action = this.passage || this.story;
    if (!action) return super.debugId();
    const description = action.id
        ? ` ${action.typeName} ${String(action.id).slice(0, 13)}...`
        : "";
    return `${super.debugId()}(${action.type}${description})`;
  }

  beginStory (store: Object, event: Object) {
    this.journeyman = this;
    this.event = event;
    this.preActionState = store.getState();
    this.updateState(this.preActionState);
    this._resourceChapters = {};
    this.story = this.createPassageFromAction(event);
    return this.story;
  }

  finishStory (resultStory: Object) {
    invariantify(this.story === resultStory,
        "bard middleware expects to get same action back which it gave to next");
    Object.values(this._resourceChapters).forEach(chapter => {
      if (!chapter.destroyed && chapter.preventsDestroys && chapter.preventsDestroys.length) {
        const { name, typeName, remoteName, remoteTypeName, remoteFieldName }
            = chapter.preventsDestroys[0];
        const message = `${remoteTypeName} ${remoteName} destruction blocked due to field '${
            remoteFieldName}' containing a reference to ${typeName} ${name}`;
        if (this.event.meta.isBeingUniversalized) throw new Error(message);
        console.warn("Suppressing a destroy prevention error (ie. DESTROYED is actually resolved)",
            "for downstream truth:", ...dumpObject(this.story),
            "\n\tsuppressed error:", message);
      }
    });
    // console.log("finishStory:", beaumpify(getActionFromPassage(this.story)));
    return this.story;
  }

  updateState (newState: Object) {
    this.objectTransient = null;
    this.setState(newState);
    return this.state;
  }

  updateStateWith (stateOperation: Function) {
    return this.updateState(stateOperation(this.state));
  }

  // Passage operations

  createPassageFromAction (action: Action) {
    const ret = Object.create(action);
    this.correlateReference(action, ret, "id");
    return ret;
  }

  initiatePassageAggregation () {
    if (this._aggregatedPassages) throw new Error("Cannot recursively nest passage aggregations");
    this._aggregatedPassages = [];
  }

  finalizeAndExtractAggregatedPassages () {
    const ret = (this.hasOwnProperty("_aggregatedPassages") && this._aggregatedPassages) || [];
    delete this._aggregatedPassages;
    return ret;
  }

  addPassage (passage: Object) {
    passage.parentPassage = this.passage;
    (this.passage.passages || (this.passage.passages = [])).push(passage);
    if (this._aggregatedPassages) this._aggregatedPassages.push(passage);
  }

  setPassages (passages: Object[]) {
    for (const passage of passages) passage.parentPassage = this.passage;
    this.passage.passages = passages;
    if (this._aggregatedPassages) this._aggregatedPassages.push(...passages);
  }

  updateStateWithPassages (parentPassage: Object = this.passage,
      passages: Object[] = parentPassage.passages) {
    if (!passages || !passages.length) return this.state;
    let nextState = this.state;
    for (const [index, passage] of passages.entries()) {
      try {
        nextState = this.updateState(this.subReduce(nextState, passage));
      } catch (error) {
        throw this.wrapErrorEvent(error, `updateStateWithPassages(#${index})`,
            "\n\tpassage:", ...dumpObject(passage),
            "\n\tparentPassage:", ...dumpObject(passage));
      }
    }
    return this.updateState(nextState);
  }

  obtainResourceChapter (rawId: string) {
    // Uses the _resourceChapters of the root bard, ie. the one which had beginStory called
    // directly on it (not any subsequent Object.create wrap).
    return this._resourceChapters[rawId] || (this._resourceChapters[rawId] = {});
  }

  // Bard resolver operations

  goToTransientOfPassageObject (typeName?: string, require?: boolean, allowGhostLookup?: boolean):
      Object {
    const id = this.passage.id;
    const ret = this.tryGoToTransientOfRawId(id.rawId(), typeName || this.passage.typeName,
        require, allowGhostLookup && id.tryGhostPath());
    if (ret) {
      if (!this.objectId) throw new Error("INTERNAL ERROR: no this.objectId");
      this.passage.id = this.objectId;
    }
    return ret;
  }


  goToTypeIntro (typeName: string): Object {
    this.objectTypeIntro = this.schema.getType(typeName);
    if (!this.objectTypeIntro) {
      throw new Error(`${this.passage.type} schema type '${typeName}' missing`);
    }
    return this.objectTypeIntro;
  }

  goToResourceTransientTypeIntro (transient: Transient): Object {
    const ret = this.goToTypeIntro(getTransientTypeName(transient, this.schema));
    if (!isResourceType(ret) && !(this.passage.meta || {}).dontUpdateCouplings) {
      throw this.wrapErrorEvent(
          new Error(`${this.passage.type} attempted on a non-Resource object`),
          new Error(`goToResourceTransientTypeIntro(${this.passage.type})`),
          "\n\ttypeIntro:", ret);
    }
    return ret;
  }

  // Reference value correlation between actions and passages.
  // For commands going upstream this means universalization of
  // references in-place on the action objects.
  // For events coming downstream this means deserialization of
  // reference field values from the action objects into corresponding
  // passage fields.

  correlateReference (action: Action, passage: Passage, propertyName: string) {
    let reference = action[propertyName];
    if (!reference) return reference;
    if (!this.event.meta.isBeingUniversalized) {
      // Downstream reduction
      if (!this.event.meta.partitionURI) {
        throw new Error(`INTERNAL ERROR: Cannot correlate downstream event reference (field '${
            propertyName}') because root action is missing meta.partitionURI`);
      }
      reference = this.obtainReference(reference, this.event.meta.partitionURI);
      passage[propertyName] = reference;
    } else {
      // Universalization of an existing VRef
      // TODO(iridian, 2018-12): If the event never gets persisted
      // (f.ex. with valaa-memory scheme) universalization can be
      // completely skipped.
      if (!(reference instanceof ValaaReference)) reference = this.obtainReference(reference, null);
      passage[propertyName] = reference;
      action[propertyName] = reference.toJSON();
    }
    return reference;
  }


  // TODO(iridian): Deserialization might happening in a wrong place:
  // it might need to happen in the middleware, not here in reducers.
  // However a lot of the infrastructure is the same, and every event
  // being replayed from the event log has already passed
  // deserialization the first time.

  deserializeField (newValue: any, fieldInfo: FieldInfo) {
    try {
      if (!fieldInfo.intro.isSequence) {
        return _obtainSingularDeserializer(fieldInfo)(newValue, this);
      }
      if (!newValue) return newValue;
      return fieldInfo.intro.isResource
          ? this.deserializeAndReduceOntoField(newValue, fieldInfo,
              (target, deserializedEntry) => target.add(deserializedEntry),
              OrderedSet())
          : this.deserializeAndReduceOntoField(newValue, fieldInfo,
              (target, deserializedEntry) => target.push(deserializedEntry),
              List());
    } catch (error) {
      throw this.wrapErrorEvent(error,
          new Error(`deserializeField(${fieldInfo.name}: ${
              fieldInfo.intro.namedType.name}${fieldInfo.intro.isSequence ? "[]" : ""})`),
          "\n\tnewValue:", newValue,
          "\n\tfieldInfo:", fieldInfo);
    }
  }

  deserializeAndReduceOntoField (incomingSequence, fieldInfo, operation, target) {
    return target.withMutations(mutableTarget => {
      const deserializeSingular = _obtainSingularDeserializer(fieldInfo);
      incomingSequence.forEach(!this.event.meta.isBeingUniversalized
          ? (serialized => operation(mutableTarget, deserializeSingular(serialized, this)))
          : ((serialized, index) => {
            const deserialized = deserializeSingular(serialized, this);
            if (deserialized instanceof ValaaReference) {
              incomingSequence[index] = deserialized.toJSON();
            }
            operation(mutableTarget, deserialized);
          }));
    });
  }

  /*
  function deserializeAsArray (bard: Bard, sequence, fieldInfo) {
    const ret = [];
    try {
      forEachDeserializeAndDo(bard, sequence, fieldInfo, deserialized => ret.push(deserialized));
      return ret;
    } catch (error) {
      throw wrapError(error, `During ${bard.debugId()}\n .deserializeAsArray(), with:`,
          "\n\tsequence:", sequence,
          "\n\tfieldInfo:", fieldInfo,
          "\n\taccumulated ret:", ret,
          "\n\tbard:", bard);
    }
  }
  */
}

function _obtainSingularDeserializer (fieldInfo) {
  const ret = fieldInfo._valaaSingularDeserializer;
  if (ret) return ret;
  return (fieldInfo._valaaSingularDeserializer =
      fieldInfo.intro.isLeaf
          ? _createDeserializeLeafValue(fieldInfo)
      : fieldInfo.intro.isResource
          ? _createResourceVRefDeserializer(fieldInfo)
          : _createSingularDataDeserializer(fieldInfo));
}

function _createDeserializeLeafValue (fieldInfo) {
  if (fieldInfo.intro.type === "LiteralValue") {
    return (serialized => serialized);
  }
  return (serialized) => {
    if ((typeof serialized !== "object") || (serialized === null)) return serialized;
    console.log("failing intro:", fieldInfo.intro);
    throw new Error(`Cannot deserialize value for leaf field ${fieldInfo.name
      }: expected primitive, got ${debugObjectType(serialized)}`);
  };
}

function _createResourceVRefDeserializer (fieldInfo) {
  function deserializeResourceVRef (serialized, bard) {
    if (!serialized) return null;
    const resourceId = bard.bindFieldVRef(
        serialized, fieldInfo, bard.event.meta.partitionURI || null);
    // Non-ghosts have the correct partitionURI in the Resource.id itself
    if (resourceId.getPartitionURI() || !resourceId.isGhost()) return resourceId;
    // Ghosts have the correct partitionURI in the host Resource.id
    const ghostPath = resourceId.getGhostPath();
    const hostId = bard.bindObjectId([ghostPath.headHostRawId()], "Resource");
    return resourceId.immutatePartitionURI(hostId.getPartitionURI());
  }
  return deserializeResourceVRef;
}

function _createSingularDataDeserializer (fieldInfo) {
  const concreteTypeName = (fieldInfo.intro.namedType instanceof GraphQLObjectType)
      && fieldInfo.intro.namedType.name;
  return function deserializeSingularData (data, bard: Bard) {
    let objectIntro;
    try {
      if (data === null) return null;
      if (typeof data === "string" || (Object.getPrototypeOf(data) !== Object.prototype)) {
        return bard.bindObjectId(
            (typeof dat === "string") ? [data] : data,
            concreteTypeName || "Data",
            bard.event.meta.partitionURI || null);
      }
      const typeName = concreteTypeName || data.typeName;
      if (!typeName) {
        invariantifyString(typeName,
          "Serialized expanded Data must have typeName field or belong to concrete field", {},
          "\n\ttypeName:", typeName,
          "\n\tdata:", data);
      }
      objectIntro = bard.schema.getType(typeName);
      if (!objectIntro) invariantify(objectIntro, `Unknown Data type '${typeName}' in schema`);
      const isBeingUniversalized = bard.event.meta.isBeingUniversalized;
      return OrderedMap().withMutations(mutableExpandedData => {
        const sortedFieldNames = Object.keys(data).sort();
        for (const fieldName of sortedFieldNames) {
          if (fieldName !== "typeName") {
            const intro = objectIntro.getFields()[fieldName];
            if (!intro) {
              invariantify(intro, `Unknown Data field '${typeName}.${fieldName}' in schema`);
            }
            const serializedValue = data[fieldName];
            let deserializedValue = serializedValue;
            if ((intro.namedType.name !== "LiteralValue") // already universalized. Should validate.
                && (typeof serializedValue === "object") && serializedValue) {
              if (isBeingUniversalized && intro.isLeaf) {
                throw new Error(`Cannot serialize value for leaf field ${
                    fieldName}:${intro.namedType.name} expected a primitive, got ${
                    debugObjectType(serializedValue)}`);
              }
              deserializedValue = bard.deserializeField(serializedValue, { intro });
              if (isBeingUniversalized && (deserializedValue instanceof ValaaReference)) {
                data[fieldName] = deserializedValue.toJSON();
              }
            }
            mutableExpandedData.set(fieldName, deserializedValue);
          } else if (!concreteTypeName) {
            mutableExpandedData.set("typeName", typeName);
          }
        }
      });
    } catch (error) {
      throw wrapError(error, `During ${bard.debugId()
              }\n.deserializeSingularData(parent field: '${fieldInfo.name}'), with:`,
          "\n\tdata:", data,
          "\n\tobject intro:", objectIntro,
          "\n\tparent fieldInfo:", fieldInfo,
          "\n\tparent field type:", fieldInfo.intro.namedType,
          "\n\tisResource:", fieldInfo.intro.isResource,
          "\n\tbard:", bard);
    }
  };
}
