// @flow

import { Iterable } from "immutable";
import type { Passage } from "~/raem";

import VALEK, { Kuery, VALKOptions, dumpObject, rootScopeSelf,
  builtinSteppers as engineBuiltinSteppers,
} from "~/engine/VALEK";

import { Command, created, duplicated, recombined, isCreatedLike } from "~/raem/events";

import ValaaReference, { vRef, IdData, getRawIdFrom } from "~/raem/ValaaReference";
import { tryHostRef } from "~/raem/VALK/hostReference";
import { getActionFromPassage } from "~/raem/redux/Bard";

import Transient, { createTransient, getTransientTypeName } from "~/raem/state/Transient";
import { isGhost } from "~/raem/tools/denormalized/ghost";
import layoutByObjectField from "~/raem/tools/denormalized/layoutByObjectField";

import type { Prophet } from "~/prophet";

import Cog, { executeHandlers } from "~/engine/Cog";
import Motor from "~/engine/Motor";
import Vrapper from "~/engine/Vrapper";
import universalizeCommandData from "~/engine/Vrapper/universalizeCommandData";
import integrateDecoding from "~/engine/Vrapper/integrateDecoding";

import { dumpify, outputCollapsedError, wrapError } from "~/tools";

export default class ValaaEngine extends Cog {
  constructor ({ name, logger, prophet, timeDilation = 1.0, verbosity }: Object) {
    super({ name: `${name}/Engine`, logger, verbosity });
    this.engine = this;
    this._prophet = prophet;
    this.cogs = new Set();
    this._vrappers = new Map();
    this._storyHandlerRoot = new Map();
    this._storyHandlerRoot.set("rawId", this._vrappers);

    this.addCog(this);
    this.motor = new Motor({ engine: this, name: `${name}/Motor`, prophet, timeDilation });
    this.addCog(this.motor);
    this.discourse = this._connectWithProphet(prophet);

    this._hostObjectDescriptors = new Map();
    this._rootScope = {};
    this._rootScope[rootScopeSelf] = this._rootScope;
  }

  _connectWithProphet (prophet: Prophet) {
    const ret = prophet.addFollower(this);
    ret.setHostValuePacker(packFromHost);
    function packFromHost (value) {
      if (value instanceof Vrapper) return value.getSelfAsHead(value.getId());
      if (Array.isArray(value)) return value.map(packFromHost);
      return value;
    }
    ret.setHostValueUnpacker((value, valker) => {
      const id = tryHostRef(value);
      if (!id) return Iterable.isIterable(value) ? value.toJS() : value;
      return this.getVrapper(id, { state: valker.getState() }, Iterable.isKeyed(value) && value);
    });
    ret.setBuiltinSteppers(engineBuiltinSteppers);
    return ret;
  }

  getSelfAsHead () {
    return this._enginePartitionId ? vRef(this._enginePartitionId) : {};
  }
  getProphet () { return this._prophet; }

  getRootScope () { return this._rootScope; }
  getLexicalScope () { return this.getRootScope(); }
  getNativeScope () { return this.getRootScope(); }
  getHostObjectDescriptors () { return this._hostObjectDescriptors; }
  getHostObjectDescriptor (objectKey: any) { return this._hostObjectDescriptors.get(objectKey); }

  getTypeDescriptor (typeName: string) {
    return this._rootScope.Valaa[typeName];
  }
  getHostObjectPrototype (typeName: string) {
    return this._rootScope.Valaa[typeName].hostObjectPrototype;
  }

  setRootScopeEntry (entryName: string, value: any) {
    this._rootScope[entryName] = value;
  }

  run (head: any, kuery: Kuery, options: VALKOptions = {}) {
    if (typeof options.scope === "undefined") options.scope = this.getLexicalScope();
    return super.run(head, kuery, options);
  }

  addCog (cog) {
    if (!this.cogs.has(cog)) {
      this.cogs.add(cog);
      cog.registerHandlers(this._storyHandlerRoot);
    }
  }

  removeCog (cog) {
    if (this.cogs.delete(cog)) {
      cog.unregisterHandlers(this._storyHandlerRoot);
    }
  }

  delayedRemoveCog (cog) {
    (this._transientDelayedCogRemovals || (this._transientDelayedCogRemovals = [])).push(cog);
  }
  _transientDelayedCogRemovals: Cog[];

  /**
   * Returns an existing Vrapper: does not return a Vrapper for non-instantiated ghost.
   * Use getVrapper with options = { optional: true } for that.
   *
   * @param {any} id
   * @returns
   */
  tryVrapper (idData: IdData) {
    const idHandlers = this._vrappers.get(getRawIdFrom(idData));
    const primaryVrapperEntry = idHandlers && idHandlers.get(null);
    return primaryVrapperEntry && primaryVrapperEntry[0];
  }

  tryVrappers (idSequence: IdData[]) {
    const ret = [];
    idSequence.forEach(idData => { ret.push(this.tryVrapper(idData)); });
    return ret;
  }

  /**
   * Returns an existing Vrapper for given id or creates a new one.
   * If an existing Vrapper cannot be found a new one is created, provided that either:
   * 1. resource exists in the state
   * 2. updateValue is specified and the id corresponds to a ghost resource.
   *
   * @param {IdData | Vrapper} id
   * @param {State} updatedState
   * @param {Transient} updateValue
   * @returns
   */
  getVrapper (idData: IdData | Vrapper, options: VALKOptions = {}, explicitTransient: Transient) {
    if (idData instanceof Vrapper) return idData;
    const vExisting = this.tryVrapper(idData);
    if (vExisting) return vExisting;
    let typeName;
    let transient;
    const state = options.state || (options.transaction || this.discourse).getState();
    try {
      if (explicitTransient) {
        typeName = getTransientTypeName(explicitTransient);
        transient = explicitTransient;
      } else {
        const rawId = getRawIdFrom(idData);
        typeName = state.getIn(["TransientFields", rawId]);
        if (typeName) {
          transient = state.getIn([typeName, rawId]);
        } else if (!isGhost(idData)) {
          if (options.optional) return undefined;
          throw new Error(`Cannot find non-ghost ${idData}:TransientFields from state`);
        } else {
          typeName = state.getIn(["TransientFields", idData.getGhostPath().rootRawId()]);
          if (typeName) {
            transient = createTransient({ id: idData, typeName });
          } else {
            if (options.optional) return undefined;
            throw new Error(`Cannot find ghost ${idData}:TransientFields root ${
                idData.getGhostPath().rootRawId()}:TransientFields from state`);
          }
        }
      }
      return new Vrapper(this, transient.get("id"), typeName, [state, transient]);
    } catch (error) {
      throw wrapError(error, `During ${this.debugId()}\n .getVrapper(${idData}), with:`,
          "\n\tidData:", ...dumpObject(idData),
          "\n\ttypeName:", ...dumpObject(typeName),
          "\n\texplicitTransient:", ...dumpObject(explicitTransient),
          "\n\ttransient:", ...dumpObject(transient),
          "\n\tstate:", ...dumpObject(state && state.toJS()));
    }
  }

  getVrappers (idSequence: IdData[], options: VALKOptions = {}) {
    const ret = [];
    idSequence.forEach(idData => { ret.push(this.getVrapper(idData, options)); });
    return ret;
  }

  create (typeName: string, initialState: Object, options: Object): Vrapper {
    return this._constructWith(created,
        { initialState, typeName },
        options,
        () => ({ typeName }),
        (constructParams, id, evaluatedInitialState) => {
          constructParams.id = id;
          constructParams.initialState = evaluatedInitialState;
        });
  }

  duplicate (duplicateOf: Vrapper, initialState: Object, options: Object): Vrapper {
    return this._constructWith(duplicated,
        { initialState, typeName: duplicateOf.getTypeName() },
        options,
        (innerOptions) => ({ duplicateOf: universalizeCommandData(duplicateOf, innerOptions) }),
        (constructParams, id, evaluatedInitialState) => {
          constructParams.id = id;
          constructParams.initialState = evaluatedInitialState;
        });
  }

  recombine (duplicationDirectives: Object, options: Object): Vrapper[] {
    return this._constructWith(recombined,
        duplicationDirectives,
        options,
        () => ({ actions: [] }),
        (constructParams, id, evaluatedInitialState, directive, innerOptions) => {
          constructParams.actions.push(duplicated({
            id,
            duplicateOf: universalizeCommandData(directive.duplicateOf, innerOptions),
            initialState: evaluatedInitialState,
          }));
        });
  }

  _constructWith (
      constructCommand: (Object) => Command,
      directives: Object,
      options: Object = {},
      createConstructParams: Object,
      addToConstructParams: Function,
  ) {
    let constructParams;
    let result;
    let ret;
    const isRecombine = Array.isArray(directives);
    const directiveArray = isRecombine ? directives : [directives];
    try {
      const transaction = (options.transaction || this.discourse).acquireTransaction();
      options.transaction = transaction;
      if (!options.head) options.head = this;
      constructParams = createConstructParams(options);
      const extractedProperties = [];

      for (const directive of directiveArray) {
        extractedProperties.push(this._extractProperties(directive.initialState, options.head));
        addToConstructParams(constructParams,
          this._resolveIdForConstructDirective(directive, options),
          universalizeCommandData(directive.initialState, options),
          directive,
          options);
      }

      result = transaction.chronicleEvent(constructCommand(constructParams));

      // FIXME(iridian): If the transaction fails the Vrapper will contain inconsistent data until
      // the next actual update on it.

      ret = directiveArray.map((directive, index) => {
        if (directive.initialState && directive.initialState.partitionAuthorityURI) {
          // Create partition(s) before the transaction is committed (and thus before the commands
          // leave upstream).
          this._createNewPartition(directive);
        }
        const id = isRecombine
            ? result.story.passages[index].id
            : result.story.id;
        const vResource = this.getVrapper(id, { transaction });
        if (vResource.isResource()) {
          Promise.resolve(vResource.activate(transaction.getState()))
              .then(undefined, (error) => {
                outputCollapsedError(localWrapError(this, error,
                    `${constructCommand.name}.activate ${vResource.debugId()}`));
              });
        }
        if (extractedProperties[index]) {
          this._updateProperties(vResource, extractedProperties[index], { transaction });
        }
        return vResource;
      });

      transaction.releaseTransaction();

      return isRecombine ? ret : ret[0];
    } catch (error) {
      throw localWrapError(this, error, `${constructCommand.name}()`);
    }
    function localWrapError (self, error, operationName) {
      return self.wrapErrorEvent(error, operationName,
          "\n\tdirectives:", ...dumpObject(directives),
          ...(!directives.initialState ? []
              : ["\n\tinitialState:", ...dumpObject(directives.initialState)]),
          "\n\toptions:", ...dumpObject(options),
          "\n\tconstruct params:", ...dumpObject(constructParams),
          "\n\tclaim result:", ...dumpObject(result),
          "\n\tret:", ...dumpObject(ret),
      );
    }
  }

  _extractProperties (initialState: Object, head: Object) {
    if (!head.getLexicalScope() || !initialState ||
        (typeof initialState.properties !== "object") ||
        initialState.properties === null ||
        Array.isArray(initialState.properties)) {
      return undefined;
    }
    const ret = initialState.properties;
    delete initialState.properties;
    return ret;
  }

  _updateProperties (target: Vrapper, properties: Object, options: VALKOptions) {
    for (const propertyName of Object.keys(properties)) {
      target.alterProperty(propertyName, VALEK.fromValue(properties[propertyName]), options);
    }
  }

  _createNewPartition (directive: Object) {
    this.engine.getProphet()
        .acquirePartitionConnection(directive.id.getPartitionURI(), { newPartition: true })
        .getSyncedConnection();
  }

  _resolveIdForConstructDirective (directive, options: VALKOptions) {
    const transaction = options.transaction;
    const initialState = directive.initialState || {};
    const explicitRawId = options.id || initialState.id;
    delete initialState.id;
    if (initialState.partitionAuthorityURI) {
      return transaction.assignNewPartitionId(directive,
          initialState.partitionAuthorityURI, explicitRawId);
    }
    const explicitOwner = initialState.owner || initialState.source;
    if (!explicitOwner) {
      return transaction.assignNewPartitionlessResourceId(directive, explicitRawId);
    }
    const partitionURI =
        ((explicitOwner instanceof ValaaReference) && explicitOwner.getPartitionURI())
        || universalizeCommandData(explicitOwner, options).getPartitionURI();
    return transaction.assignNewResourceId(directive, partitionURI && String(partitionURI),
        explicitRawId);
  }

  outputStatus (output = console) {
    output.log(`${this.name}: Resources:`,
        layoutByObjectField(this.getProphet().getState(), "name"));
    output.log(`${this.name}: Handlers:`, this._storyHandlerRoot);
    output.log(`${this.name}: Cogs:`);
    for (const cog of this.cogs) if (cog !== this) cog.outputStatus(output);
  }

  requestFullScreen () {
    // TODO(iridian): This should happen through prophet to reach the cogs in uniform
    // manner.
    for (const cog of this.cogs) {
      if (cog !== this && cog.requestFullScreen) cog.requestFullScreen();
    }
  }

  receiveCommands (stories: Command[]) {
    let allReactionPromises;
    stories.forEach(story => {
      const { timed, state, previousState } = story;
      const _recitePassage = (passage: Passage) => {
        if (this.getVerbosity() || timed) {
          // eslint-disable-next-line
          const { parentPassage, passages, type, state, previousState, next, prev, ...rest } = passage;
          this.logEvent(`recitePassage`, _eventTypeString(passage), String(passage.id),
              (timed ? `@ ${timed.startTime || "|"}->${timed.time}:` : ":"),
              "\n\taction:", dumpify(getActionFromPassage(passage)),
              "\n\tpassage:", dumpify(rest));
        }
        passage.timedness = timed ? "Timed" : "Timeless";
        let vProtagonist;
        try {
          if (passage.id) {
            passage.rawId = passage.id.rawId();
            const protagonistEntry = this._vrappers.get(passage.rawId);
            if (protagonistEntry && protagonistEntry.get(null)) {
              vProtagonist = protagonistEntry.get(null)[0];
            }
            if (isCreatedLike(passage)) {
              if (!vProtagonist) {
                vProtagonist = new Vrapper(this, passage.id, passage.typeName);
              } else vProtagonist._setTypeName(passage.typeName);
              if (vProtagonist.isResource()) {
                Promise.resolve(vProtagonist.activate(state))
                    .then(undefined, (error) => {
                      outputCollapsedError(errorOnReceiveCommands.call(this, error,
                        `receiveCommands(${passage.type} ${vProtagonist.debugId()}).activate`));
                    });
              }
            }
          }
          const reactions = executeHandlers(this._storyHandlerRoot, passage,
              [vProtagonist, passage, story]);
          if (reactions) (allReactionPromises || (allReactionPromises = [])).push(...reactions);
          if (passage.passages) passage.passages.forEach(_recitePassage);
        } catch (error) {
          throw errorOnReceiveCommands.call(this, error,
              new Error(`_recitePassage(${passage.type} ${
                  vProtagonist ? vProtagonist.debugId() : ""})`),
              "\n\tstory.state:", state && state.toJS(),
              "\n\tstory.previousState:", previousState && previousState.toJS());
        }
        function errorOnReceiveCommands (error, operationName, ...extraContext) {
          return this.wrapErrorEvent(error, operationName,
              "\n\tvProtagonist:", vProtagonist,
              "\n\tpassage:", passage,
              "\n\tstory:", story,
              ...extraContext);
        }
      };
      _recitePassage.call(this, story);
      if (this._transientDelayedCogRemovals) {
        this._transientDelayedCogRemovals.forEach(cog => this.removeCog(cog));
        this._transientDelayedCogRemovals = null;
      }
    });
    function _eventTypeString (innerPassage, submostEventType = innerPassage.type) {
      if (!innerPassage.parentPassage) return submostEventType;
      return `sub-${_eventTypeString(innerPassage.parentPassage, submostEventType)}`;
    }
    return allReactionPromises;
  }

  receiveTruths () {}

  rejectHeresy (/* rejectedEvent, purgedCorpus, revisedEvents */) {
    // console.log("HERESY Rejected", rejectedEvent);
  }

  start () { return this.motor.start(); }
  setTimeOrigin (timeOrigin) { return this.motor.setTimeOrigin(timeOrigin); }
  isPaused () { return this.motor.isPaused(); }
  setPaused (value = true) { return this.motor.setPaused(value); }
  getTimeDilation () { return this.motor.getTimeDilation(); }
  setTimeDilation (timeDilation) { return this.motor.setTimeDilation(timeDilation); }

  _integrateDecoding (...rest: any[]) {
    return integrateDecoding(...rest);
  }
}
