// @flow

import { Iterable } from "immutable";
import type { Passage, Story, VALKOptions } from "~/raem";

import VALEK, { Kuery, dumpObject, rootScopeSelf,
  builtinSteppers as engineBuiltinSteppers,
} from "~/engine/VALEK";

import { Command, created, duplicated, recombined, isCreatedLike } from "~/raem/events";

import VRL, { vRef, IdData, getRawIdFrom } from "~/raem/VRL";
import { tryHostRef } from "~/raem/VALK/hostReference";
import { getActionFromPassage } from "~/raem/redux/Bard";

import Transient, { createTransient, getTransientTypeName } from "~/raem/state/Transient";
import layoutByObjectField from "~/raem/tools/denormalized/layoutByObjectField";

import type { Prophet } from "~/prophet";

import Cog, { executeHandlers } from "~/engine/Cog";
import Motor from "~/engine/Motor";
import Vrapper from "~/engine/Vrapper";
import universalizeCommandData from "~/engine/Vrapper/universalizeCommandData";
import integrateDecoding from "~/engine/Vrapper/integrateDecoding";
import FieldUpdate from "~/engine/Vrapper/FieldUpdate";

import { debugObjectType, dumpify, outputCollapsedError, thenChainEagerly, wrapError }
    from "~/tools";

export default class Engine extends Cog {
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
    this._activeIdentities = {};
    this._currentPassageCounter = 0;
    this._identityManager = {
      add: (identityPartitionURI: any /* , options: {} */) => {
        try {
          if (!identityPartitionURI) {
            throw new Error(`identityPartition required, got: ${
                debugObjectType(identityPartitionURI)}`);
          }
          const identityAuthority = prophet.obtainPartitionAuthority(identityPartitionURI);
          if (!identityAuthority) {
            throw new Error(`Can't locate the authority for identityPartition: <${
                identityPartitionURI}>`);
          }
          this._activeIdentities[String(identityPartitionURI)] = true;
          return true;
        } catch (error) {
          throw this.wrapErrorEvent(error, new Error("valos.identity.add"),
              "\n\tidentityPartitionURI:", ...dumpObject(identityPartitionURI));
        }
      },
      remove: (identityPartitionURI: any) => {
        try {
          if (!identityPartitionURI) {
            throw new Error(`identityPartition required, got: ${
                debugObjectType(identityPartitionURI)}`);
          }
          const uriString = String(identityPartitionURI);
          if (this._activeIdentities[uriString]) {
            throw new Error(`No such active identity: <${uriString}>`);
          }
          delete this._activeIdentities[uriString];
          return true;
        } catch (error) {
          throw this.wrapErrorEvent(error, new Error("valos.identity.remove"),
              "\n\tidentityPartitionURI:", ...dumpObject(identityPartitionURI));
        }
      },
    };

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
    return this._rootScope.valos[typeName];
  }
  getHostObjectPrototype (typeName: string) {
    return (this._rootScope.valos[typeName] || {}).hostObjectPrototype;
  }
  getIdentityManager () {
    return this._identityManager;
  }
  setRootScopeEntry (entryName: string, value: any) {
    this._rootScope[entryName] = value;
  }

  run (head: any, kuery: Kuery, options: VALKOptions = {}) {
    if (options.scope === undefined) options.scope = this.getLexicalScope();
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
    const discourse = options.transaction || this.discourse;
    const state = options.state || discourse.getState();
    const id = discourse.obtainReference(idData);
    try {
      if (explicitTransient) {
        typeName = getTransientTypeName(explicitTransient, discourse.schema);
        transient = explicitTransient;
      } else {
        const rawId = id.rawId();
        typeName = state.getIn(["TransientFields", rawId]);
        if (typeName) {
          transient = state.getIn([typeName, rawId]);
        } else if (!id.isGhost()) {
          if (options.optional) return undefined;
          throw new Error(`Cannot find non-ghost ${id}:TransientFields from state`);
        } else {
          typeName = state.getIn(["TransientFields", id.getGhostPath().rootRawId()]);
          if (typeName) {
            transient = createTransient({ id, typeName });
          } else {
            if (options.optional) return undefined;
            throw new Error(`Cannot find ghost ${id}:TransientFields root ${
                id.getGhostPath().rootRawId()}:TransientFields from state`);
          }
        }
      }
      return new Vrapper(this, transient.get("id"), typeName, [state, transient]);
    } catch (error) {
      throw wrapError(error, `During ${this.debugId()}\n .getVrapper(${idData}), with:`,
          "\n\tidData:", ...dumpObject(idData),
          "\n\tid:", ...dumpObject(id),
          "\n\ttypeName:", ...dumpObject(typeName),
          "\n\texplicitTransient:", ...dumpObject(explicitTransient),
          "\n\ttransient:", ...dumpObject(transient),
          "\n\tstate:", ...dumpObject(state && state.toJS()));
    }
  }

  getVrapperByRawId (rawId: string, options: VALKOptions, explicitTransient: Transient) {
    return this.getVrapper(new VRL(rawId), options, explicitTransient);
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
    const extractedProperties = [];
    let transaction;
    try {
      transaction = (options.transaction || this.discourse).acquireTransaction("construct");
      options.transaction = transaction;
      if (!options.head) options.head = this;
      constructParams = createConstructParams(options);

      for (const directive of directiveArray) {
        extractedProperties.push(this._extractProperties(directive.initialState, options.head));
        addToConstructParams(constructParams,
          this._resolveIdForConstructDirective(directive, options),
          universalizeCommandData(directive.initialState, options),
          directive,
          options);
      }

      result = transaction.chronicleEvent(constructCommand(constructParams));

      // FIXME(iridian): If the transaction fails the Vrapper will
      // contain inconsistent data until the next actual update on it.

      ret = directiveArray.map((directive, index) => {
        if (directive.initialState && directive.initialState.partitionAuthorityURI) {
          // Create partition(s) before the transaction is committed (
          // and thus before the commands leave to upstream).
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
                    `${constructCommand.name}.activate ${vResource.debugId()}`),
                    `Exception caught during resource activation of ${vResource.debugId()}`);
              });
        }
        if (extractedProperties[index]) {
          this._updateProperties(vResource, extractedProperties[index], { transaction });
        }
        return vResource;
      });
      const vRet = isRecombine ? ret : ret[0];
      transaction.releaseTransaction();
      return !options.awaitResult ? vRet
          : thenChainEagerly(options.awaitResult(result, vRet), () => vRet);
    } catch (error) {
      if (transaction) transaction.abortTransaction();
      throw localWrapError(this, error, `${constructCommand.name}()`);
    }
    function localWrapError (self, error, operationName) {
      return self.wrapErrorEvent(error, operationName,
          "\n\tdirectives:", ...dumpObject(directives),
          ...(!directives.initialState ? []
              : ["\n\tinitialState:", ...dumpObject(directives.initialState)]),
          "\n\toptions:", ...dumpObject(options),
          "\n\tconstruct params:", ...dumpObject(constructParams),
          "\n\textractedProperties:", ...dumpObject(extractedProperties),
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
      const kuery = VALEK.fromValue(properties[propertyName]);
      try {
        target.alterProperty(propertyName, kuery, Object.create(options));
      } catch (error) {
        throw this.wrapErrorEvent(error,
            new Error(`constructWith._updateProperties(${propertyName})`),
            "\n\tobject:", ...dumpObject(target),
            "\n\tvalue:", ...dumpObject(properties[propertyName]),
            "\n\talter value kuery:", ...dumpObject(kuery),
            "\n\toptions:", ...dumpObject(options),
        );
      }
    }
  }

  _createNewPartition (directive: Object) {
    this.engine.getProphet()
        .acquirePartitionConnection(directive.id.getPartitionURI(), { newPartition: true })
        .getActiveConnection();
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
    let owner = initialState.owner || initialState.source;
    if (owner) {
      if (!(owner instanceof VRL)) owner = universalizeCommandData(owner, options);
      if (owner instanceof VRL) {
        let partitionURI = owner.getPartitionURI();
        if (!partitionURI && owner.isGhost()) {
          partitionURI = transaction
              .bindObjectId([owner.getGhostPath().headHostRawId()], "Resource")
              .getPartitionURI();
        }
        if (partitionURI) {
          return transaction.assignNewResourceId(directive, String(partitionURI), explicitRawId);
        }
      }
    }
    return transaction.assignNewPartitionlessResourceId(directive, explicitRawId);
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
    const allReactionPromises = [];
    const finalizer = { then (finalize) { this.finalize = finalize; } };
    this.obtainGroupTransaction("local-events", { setAsGlobal: true, finalizer });
    // TODO(iridian, 2019-03): Mark UI-transactions as local-only. It
    // is acceptable that UI operations manage in-memory/local state
    // but remote updates should be explicitly performed in
    // a separate (via Promise.resolve().then or via explicit
    // valosheath API)
    for (const story of stories) {
      story._delayedCogRemovals = [];
      story._delayedFieldUpdates = [];
      try {
        this._recitePassage(story, story, allReactionPromises);
        story._delayedCogRemovals.forEach(cog => this.removeCog(cog));
        story._delayedCogRemovals = null;
        story._delayedFieldUpdates.forEach(fieldUpdate => {
          fieldUpdate.getEmitter()._notifyMODIFIEDHandlers(
              fieldUpdate, fieldUpdate._delayedFieldHooks, fieldUpdate._delayedFilterHooks);
        });
        story._delayedFieldUpdates = null;
      } catch (error) {
        outputCollapsedError(error, "Exception caught during Engine.receiveCommands");
      }
    }
    finalizer.finalize(true);
    return allReactionPromises.length ? allReactionPromises : undefined;
  }

  _recitePassage (passage: Passage, story: Story, allReactionPromises) {
    if (this.getVerbosity() || story.timed) {
      // eslint-disable-next-line
      const { parentPassage, passages, type, state, previousState, next, prev, ...rest } = passage;
      this.logEvent(`recitePassage`, _eventTypeString(passage),
          ...[passage.typeName].filter(p => p), String(passage.id),
          (story.timed ? `@ ${story.timed.startTime || "|"}->${story.timed.time}:` : ":"),
          "\n\taction:", dumpify(getActionFromPassage(passage)),
          "\n\tpassage:", dumpify(rest));
    }
    passage.timedness = story.timed ? "Timed" : "Timeless";
    passage._counter = ++this._currentPassageCounter;
    try {
      if (passage.id) {
        passage.rawId = passage.id.rawId();
        const protagonistEntry = this._vrappers.get(passage.rawId);
        if (protagonistEntry && protagonistEntry.get(null)) {
          passage.vProtagonist = protagonistEntry.get(null)[0];
        }
        if (isCreatedLike(passage)) {
          if (!passage.vProtagonist) {
            passage.vProtagonist = new Vrapper(this, passage.id, passage.typeName);
          } else passage.vProtagonist._setTypeName(passage.typeName);
          if (passage.vProtagonist.isResource()) {
            // vProtagonist.refreshPhase(story.state);
            // /*
            Promise.resolve(passage.vProtagonist.refreshPhase(story.state))
                .then(undefined, (error) => {
                  outputCollapsedError(errorOnReceiveCommands.call(this, error,
                      `receiveCommands(${passage.type} ${
                        passage.vProtagonist.debugId()}).refreshPhase`),
                      "Exception caught during passage recital protagonist refresh phase");
                });
            // */
          }
        }
      }
      const reactions = executeHandlers(this._storyHandlerRoot, passage, story);
      if (reactions) allReactionPromises.push(...reactions);
      if (passage.passages) {
        for (const subPassage of passage.passages) {
          this._recitePassage(subPassage, story, allReactionPromises);
        }
      }
    } catch (error) {
      throw errorOnReceiveCommands.call(this, error,
          new Error(`_recitePassage(${passage.type} ${
            passage.vProtagonist ? passage.vProtagonist.debugId() : ""})`),
          "\n\tstory.state:", ...dumpObject(story.state),
          "\n\tstory.previousState:", ...dumpObject(story.previousState));
    }
    function errorOnReceiveCommands (error, operationName, ...extraContext) {
      return this.wrapErrorEvent(error, operationName,
          "\n\tvProtagonist:", passage.vProtagonist,
          "\n\tpassage:", ...dumpObject(passage),
          "\n\tstory:", ...dumpObject(story),
          ...extraContext);
    }
    function _eventTypeString (innerPassage, submostEventType = innerPassage.type) {
      if (!innerPassage.parentPassage) return submostEventType;
      return `sub-${_eventTypeString(innerPassage.parentPassage, submostEventType)}`;
    }
  }

  addDelayedRemoveCog (cog, story: Story) {
    story._delayedCogRemovals.push(cog);
  }

  addDelayedFieldUpdate (vrapper: Vrapper, fieldName: string,
      fieldHooks, filterHooks, passage: Passage, story: Story) {
    const fieldUpdate = new FieldUpdate(vrapper, fieldName, passage, story);
    fieldUpdate._delayedFieldHooks = fieldHooks;
    fieldUpdate._delayedFilterHooks = filterHooks;
    story._delayedFieldUpdates.push(fieldUpdate);
  }

  _pendingTransactions = {};

  obtainGroupTransaction (groupName: string, {
    setAsGlobal = false,
    finalizer = Promise.resolve(true),
  }: Object = {}) {
    let ret = this._pendingTransactions[groupName];
    if (ret) {
      finalizer.then(() => undefined);
    } else {
      ret = this._pendingTransactions[groupName] = this.discourse.acquireTransaction(groupName);
      if (setAsGlobal && (this.discourse.rootDiscourse === this.discourse)) {
        // If there is no current transaction as the global discourse
        // set this transaction as the global one.
        this.discourse = ret;
      }
      finalizer.then(() => {
        delete this._pendingTransactions[groupName];
        // If the global discourse is us, revert it back.
        if (this.discourse === ret) this.discourse = ret.rootDiscourse;
        ret.releaseTransaction();
      });
    }
    return ret;
  }

  getActiveGlobalOrNewLocalEventGroupTransaction = () =>
      ((this.discourse !== this.discourse.rootDiscourse)
          ? this.discourse
          : this.obtainGroupTransaction("local-events", { setAsGlobal: true, }))

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
