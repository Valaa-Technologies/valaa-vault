// @flow
import { GraphQLObjectType } from "graphql/type";
import { Map } from "immutable";
import cloneDeep from "lodash/cloneDeep";

import type Command, { Action } from "~/valaa-core/command";
import isResourceType from "~/valaa-core/tools/graphql/isResourceType";
import Resolver from "~/valaa-core/tools/denormalized/Resolver";
import { getTransientTypeName } from "~/valaa-core/tools/denormalized/Transient";
import type { State } from "~/valaa-core/tools/denormalized/State";
import { obtainVRef, getRawIdFrom } from "~/valaa-core/ValaaReference";

import { dumpObject, invariantify, outputCollapsedError } from "~/valaa-tools";

/**
 * Bard subsystem.
 */

export type Passage = Action;
export type Story = Passage;

export function createUniversalizableCommand (restrictedCommand: Command) {
  return cloneDeep(restrictedCommand);
}

export function isRestrictedCommand (action: Action) {
  return !action.partitions;
}

export function createPassageFromAction (action: Action) {
  return Object.create(action);
}

export function getActionFromPassage (passage: Passage) {
  const ret = Object.getPrototypeOf(passage);
  if (ret === Object.prototype) return undefined;
  return ret;
}

/**
 * Bard middleware creates a 'journeyman' bard (which prototypes a singleton-ish master bard) to
 * handle an incoming command or event action. It then smuggles the journeyman inside
 * action[SmuggledBard] through redux to the master bard reducers, where new bard apprentices are
 * created to handle each sub-action.
 *
 * The fluff: journeyman bard arrives with a story of some event and recruits apprentices to flesh
 * out the passages of the event details for everyone to hear. In doing so the bards use the
 * knowledge provided by the master bard (reducers, schema, logger).
 *
 * @export
 * @param {{
 *   name: any, schema: GraphQLSchema, logger: Object, subReduce: () => any
 * }} bardOptions
 * @returns
 */
export function createBardMiddleware () {
  const bardMiddleware = (grandmaster: Object) => (next: any) =>
      (action: Action, master: Bard = grandmaster) => {
        const journeyman = Object.create(master);
        const story = journeyman.beginStory(master, action);
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
      if (apprentice.story.isBeingUniversalized) {
        throw apprentice.wrapErrorEvent(error, `bardOperation(${apprentice.passage.type})`,
            "\n\taction:", ...dumpObject(getActionFromPassage(apprentice.passage)),
            "\n\tpassage:", ...dumpObject(apprentice.passage),
            "\n\tapprentice:", ...dumpObject(apprentice),
        );
      }
      outputCollapsedError(apprentice.wrapErrorEvent(error,
          `bardOperation(${apprentice.passage.type}) - sub-event IGNORED, reduction skipped`,
          "\n\taction:", ...dumpObject(getActionFromPassage(apprentice.passage)),
          "\n\tpassage:", ...dumpObject(apprentice.passage),
          "\n\tapprentice:", ...dumpObject(apprentice),
      ), undefined, "Exception caught during event playback (corresponding sub-event IGNORED)");
      return state;
    } finally {
      delete apprentice.passage.apprentice;
    }
  };
}

/**
 * Bard processes incoming downstream events and upstream commands against current corpus state.
 *
 * A bard has three primary responsibilities. For each command/event action, it:
 * 1. reduces the action against the corpus, ie. updates the corpus state based on the action
 * 2. creates a story, a convenience action which wraps the root action as its prototype
 * 3. creates a passage for each concrete and virtual sub-actions, wrapping them as prototypes
 * 4. universalizes a command, by validating and extends a command action before it's sent upstream
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
 * should not be stored in the command/event objects themselves. This includes information such as
 * actualAdds/actualRemoves for a MODIFIED class of operations, passages lists for transactions
 * and for actions which involve coupling updates, etc.
 *
 * Command universalisation:
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
 * Command objects coming in from downstream can be incomplete in the universal context.
 * For example ghost objects and their ownership relationships might depend on information that is
 * only available in their prototypes: this prototype and all the information on all its owned
 * objects can reside in another partition.
 * Command universalisation is the process where the command is extended to contain all information
 * that is needed for its playback on the universal context.
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
    return `${this.constructor.name}(${action.type} ${action.id}:${action.typeName})`;
  }

  beginStory (store: Object, action: Object) {
    this.journeyman = this;
    this.rootAction = action;
    this.preActionState = store.getState();
    this.updateState(this.preActionState);
    this._resourceChapters = {};
    this.story = createPassageFromAction(action);
    if (!action.partitions) {
      action.partitions = {};
      this.story.isBeingUniversalized = true;
    }
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
        if (this.story.isBeingUniversalized) throw new Error(message);
        console.warn("Suppressing a destroy prevention error (ie. the DESTROYED is resolved)",
            "for downstream event:", ...dumpObject(this.story),
            "\n\tsuppressed error:", message);
      }
    });
    delete this.story.isBeingUniversalized;
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

  obtainResourceChapter (idData: any) {
    // Uses the _resourceChapters of the root bard, ie. the one which had beginStory called
    // directly on it (not any subsequent Object.create wrap).
    return this._resourceChapters[getRawIdFrom(idData)]
        || (this._resourceChapters[getRawIdFrom(idData)] = {});
  }

  getPassageObjectId () {
    return obtainVRef(this.passage.id);
  }

  goToTransientOfActionObject (options:
      { typeName?: string, require?: boolean, nonGhostLookup?: boolean } = {}): Object {
    this.objectId = this.getPassageObjectId();
    const ret = this.tryGoToTransientOfRawId(
        this.objectId.rawId(),
        options.typeName || this.passage.typeName,
        options.require,
        !options.nonGhostLookup && this.objectId.tryGhostPath());
    this.passage.id = this.objectId;
    return ret;
  }

  goToObjectTypeIntro (operationDescription: string = this.passage.type): Object {
    this.objectTypeIntro = this.schema.getType(this.typeName
        || getTransientTypeName(this.objectTransient));
    if (!this.objectTypeIntro) {
      throw new Error(`${operationDescription} schema introspection missing for type '${
          getTransientTypeName(this.objectTransient)}'`);
    }
    return this.objectTypeIntro;
  }

  goToResourceTypeIntro (operationDescription: string = this.passage.type): Object {
    const ret = this.goToObjectTypeIntro(operationDescription);
    if (!isResourceType(ret) && !this.passage.dontUpdateCouplings) {
      throw this.wrapErrorEvent(
          new Error(`${operationDescription} attempted on a non-Resource object`),
          `goToResourceTypeIntro(${operationDescription})`,
          "\n\ttypeIntro:", ret);
    }
    return ret;
  }
}
