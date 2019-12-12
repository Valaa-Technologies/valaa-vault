// @flow

import { Iterable } from "immutable";
import type { Passage, Story, VALKOptions } from "~/raem";

import VALEK, { Kuery, dumpObject, rootScopeSelf, engineSteppers } from "~/engine/VALEK";

import { Command, created, duplicated, recombined, isCreatedLike } from "~/raem/events";

import VRL, { vRef, IdData, getRawIdFrom } from "~/raem/VRL";
import { tryHostRef } from "~/raem/VALK/hostReference";
import { getActionFromPassage } from "~/raem/redux/Bard";
import { formVPath } from "~/raem/VPath";

import Transient, { createTransient, getTransientTypeName } from "~/raem/state/Transient";
import layoutByObjectField from "~/raem/tools/denormalized/layoutByObjectField";

import type { Sourcerer } from "~/sourcerer";
import { StoryRecital } from "~/sourcerer/FalseProphet/StoryRecital";

import Cog, { executeHandlers } from "~/engine/Cog";
import Motor from "~/engine/Motor";
import Vrapper from "~/engine/Vrapper";
import universalizeCommandData from "~/engine/Vrapper/universalizeCommandData";
import integrateDecoding from "~/engine/Vrapper/integrateDecoding";
import LiveUpdate from "~/engine/Vrapper/LiveUpdate";
import Subscription from "~/engine/Vrapper/Subscription";

import { outputCollapsedError, thenChainEagerly, wrapError } from "~/tools";

export default class Engine extends Cog {
  constructor ({ name, logger, sourcerer, timeDilation = 1.0, verbosity }: Object) {
    super({ name: `${name}/Engine`, logger, verbosity });
    this.engine = this;
    this._sourcerer = sourcerer;
    this.cogs = new Set();
    this._vrappers = new Map();
    this._storyHandlerRoot = new Map();
    this._storyHandlerRoot.set("rawId", this._vrappers);

    this.addCog(this);
    this.motor = new Motor({ engine: this, name: `${name}/Motor`, sourcerer, timeDilation });
    this.addCog(this.motor);
    this.discourse = this._connectWithSourcerer(sourcerer);
    this._currentPassageCounter = 0;
    this._hostDescriptors = new Map();
    this._rootScope = {};
    this._rootScope[rootScopeSelf] = this._rootScope;
  }

  _connectWithSourcerer (sourcerer: Sourcerer) {
    const ret = sourcerer.addFollower(this, { verbosity: this.getVerbosity() - 1 });
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
    ret.setSteppers(engineSteppers);
    return ret;
  }

  debugId () { return `${super.debugId()}->${this.discourse.debugId()}`; }

  getSelfAsHead () {
    return this._enginePartitionId ? vRef(this._enginePartitionId) : {};
  }
  getSourcerer () { return this._sourcerer; }

  getRootScope () { return this._rootScope; }
  getLexicalScope () { return this.getRootScope(); }
  getNativeScope () { return this.getRootScope(); }
  getHostDescriptors () { return this._hostDescriptors; }
  getHostObjectDescriptor (objectKey: any) { return this._hostDescriptors.get(objectKey); }

  getValospaceTypePrototype (typeName: string) {
    return (this._rootScope.valos[typeName] || {}).prototype;
  }
  getIdentityManager () {
    return this.discourse._identityManager;
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
    const discourse = options.discourse || this.discourse;
    const state = options.state || discourse.getState();
    const id = discourse.obtainReference(idData, options.contextPartitionURI);
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
    let discourse;
    try {
      discourse = (options.discourse || this.discourse).acquireFabricator("construct");
      options.discourse = discourse;
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

      result = discourse.chronicleEvent(constructCommand(constructParams));

      // FIXME(iridian): If the transaction fails the Vrapper will
      // contain inconsistent data until the next actual update on it.

      ret = directiveArray.map((directive, index) => {
        if ((directive.initialState || {}).partitionAuthorityURI) {
          // Create partition(s) before the transaction is committed
          // (and thus before the commands leave upstream).
          discourse
              .acquireConnection(directive.id.getPartitionURI(), { newPartition: true })
              .asActiveConnection();
        }
        const resultPassage = !isRecombine ? result.story : result.story.passages[index];
        const vResource = this.getVrapper(resultPassage.id, { discourse });
        if (vResource.isResource()) {
          if (resultPassage.typeName) vResource._setTypeName(resultPassage.typeName);
          const state = discourse.getState();
          const initialBlocker = vResource.refreshPhase(state);
          if (initialBlocker) {
            Promise.resolve(vResource.activate({ state, allowNonCreated: true, initialBlocker }))
                .then(undefined, (error) => {
                  outputCollapsedError(localWrapError(this, error,
                      `${constructCommand.name}.activate ${vResource.debugId()}`),
                      `Exception caught during resource construction activate of ${
                        vResource.debugId()}`);
                });
          }
        }
        if (extractedProperties[index]) {
          this._updateProperties(vResource, extractedProperties[index], { discourse });
        }
        return vResource;
      });
      const vRet = isRecombine ? ret : ret[0];
      discourse.releaseFabricator();
      return !options.awaitResult ? vRet
          : thenChainEagerly(options.awaitResult(result, vRet), () => vRet);
    } catch (error) {
      if (discourse) discourse.releaseFabricator({ rollback: error });
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
          "\n\tclaim event:", ...dumpObject(result.event),
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

  _resolveIdForConstructDirective (directive, options: VALKOptions) {
    const discourse = options.discourse;
    const initialState = directive.initialState || {};
    let explicitRawId = options.id || initialState.id;
    if (explicitRawId && (typeof explicitRawId !== "string")) {
      if (!Array.isArray(explicitRawId)) {
        throw new Error("explicit id must be either a string or a VPath steps array");
      }
      explicitRawId = formVPath(...explicitRawId);
      if (explicitRawId[1] !== "$") throw new Error("explicit vrid must have a GRId as first step");
    }
    delete initialState.id;
    if (initialState.authorityURI) {
      initialState.partitionAuthorityURI = initialState.authorityURI;
      delete initialState.authorityURI;
    }
    if (initialState.partitionAuthorityURI) {
      return discourse.assignNewPartitionId(
          directive, initialState.partitionAuthorityURI, explicitRawId);
    }
    let owner = initialState.owner || initialState.source;
    if (owner) {
      if (!(owner instanceof VRL)) owner = universalizeCommandData(owner, options);
      if (owner instanceof VRL) {
        let partitionURI = owner.getPartitionURI();
        if (!partitionURI && owner.isGhost()) {
          partitionURI = discourse
              .bindObjectId([owner.getGhostPath().headHostRawId()], "Resource")
              .getPartitionURI();
        }
        if (partitionURI) {
          return discourse.assignNewResourceId(directive, String(partitionURI), explicitRawId);
        }
      }
    }
    return discourse.assignNewPartitionlessResourceId(directive, explicitRawId);
  }

  outputStatus (output = console) {
    output.log(`${this.name}: Resources:`,
        layoutByObjectField(this.getSourcerer().getState(), "name"));
    output.log(`${this.name}: Handlers:`, this._storyHandlerRoot);
    output.log(`${this.name}: Cogs:`);
    for (const cog of this.cogs) if (cog !== this) cog.outputStatus(output);
  }

  requestFullScreen () {
    // TODO(iridian): This should happen through sourcerer to reach the cogs in uniform
    // manner.
    for (const cog of this.cogs) {
      if (cog !== this && cog.requestFullScreen) cog.requestFullScreen();
    }
  }

  receiveCommands (stories: Command[], purgedRecital: ?StoryRecital, purgedProtagonists: ?Set) {
    const recitalReactionPromises = !purgedProtagonists && [];
    const finalizer = { then (finalize) { this.finalize = finalize; } };
    const tx = !purgedProtagonists
        && this.obtainGroupTransaction("local-events", { setAsGlobal: true, finalizer });
    // TODO(iridian, 2019-03): Mark UI-transactions as local-only. It
    // is acceptable that UI operations manage in-memory/local state
    // but remote updates should be explicitly performed in
    // a separate (via Promise.resolve().then or via explicit
    // valosheath API)
    if (purgedRecital) {
      const vProtagonists = this.receiveCommands(purgedRecital, null, new Set());
      const rollbackState = purgedRecital.getFirst().previousState;
      const purgeUpdate = new Subscription(null, { state: rollbackState })
          .initializeFilter(true);
      for (const vProtagonist of vProtagonists) {
        if (vProtagonist._fieldSubscriptions) {
          for (const subscription of vProtagonist._fieldSubscriptions.values()) {
            subscription.triggerFieldUpdate(rollbackState, null, this._currentPassageCounter);
          }
        }
        purgeUpdate._emitter = vProtagonist;
        vProtagonist.triggerFilterHooks(purgeUpdate, this._currentPassageCounter);
      }
    }
    this.logEvent(1, () => [
      !purgedProtagonists ? "reciting" : "purging",
      stories.length, "stories in", tx && tx.debugId(), ":", ...dumpObject(stories),
    ]);
    for (const story of stories) {
      story._delayedCogRemovals = [];
      story._delayedFieldUpdates = new Set();
      try {
        this._recitePassage(story, story, recitalReactionPromises, purgedProtagonists);
        story._delayedCogRemovals.forEach(cog => this.removeCog(cog));
        story._delayedCogRemovals = null;
        for (const fieldUpdate of story._delayedFieldUpdates) {
          const passage = fieldUpdate._passage;
          fieldUpdate.triggerFieldUpdate(passage.state || story.state,
              passage.previousState || story.previousState, passage._counter);
          fieldUpdate._emitter.triggerFilterHooks(fieldUpdate, passage._counter);
          fieldUpdate.clearPassageTemporaries();
        }
        story._delayedFieldUpdates = null;
      } catch (error) {
        outputCollapsedError(error, "Exception caught during Engine.receiveCommands recital");
      }
    }
    this.logEvent(1, () => [
      !purgedProtagonists ? "recited" : "purged", stories.length, "stories in", tx && tx.debugId(),
    ]);
    if (purgedProtagonists) return purgedProtagonists;
    finalizer.finalize(true);
    return recitalReactionPromises.length ? recitalReactionPromises : undefined;
  }

  _recitePassage (passage: Passage, story: Story, recitalReactionPromises, purges: ?Set) {
    passage.timedness = story.timed ? "Timed" : "Timeless";
    passage._counter = ++this._currentPassageCounter;
    if (this.getVerbosity() || story.timed) {
      // eslint-disable-next-line
      const { parentPassage, passages, type, state, previousState, next, prev, ...rest } = passage;
      this.logEvent(passage !== story ? 3 : 2, () => [
        passage !== story ? "recitePassage" : "reciteStory", `#${this._currentPassageCounter}`,
        `#${story.storyIndex}/${passage.passageIndex}`,
        this._eventTypeString(passage), ...[passage.typeName].filter(p => p), String(passage.id),
        (story.timed ? `@ ${story.timed.startTime || "|"}->${story.timed.time}:` : ":"),
        "\n\taction:", ...dumpObject(getActionFromPassage(passage)),
        "\n\tpassage:", ...dumpObject(rest),
      ]);
    }
    try {
      if (!purges) {
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
              const blocker = passage.vProtagonist.refreshPhase(story.state);
              if (blocker !== undefined) {
                Promise.resolve(blocker).then(undefined, (error) => {
                  outputCollapsedError(errorOnReceiveCommands.call(this, error,
                      `receiveCommands(${passage.type} ${
                        passage.vProtagonist.debugId()}).refreshPhase`),
                      "Exception caught during passage recital protagonist refresh phase");
                });
              }
            }
          }
        }
        const reactions = executeHandlers(this._storyHandlerRoot, passage, story);
        if (reactions) recitalReactionPromises.push(...reactions);
      } else if (passage.vProtagonist) {
        if (passage.vProtagonist.purgePassage(passage)) {
          purges.add(passage.vProtagonist);
        } else {
          purges.delete(passage.vProtagonist);
        }
      }
      if (passage.passages) {
        for (const subPassage of passage.passages) {
          this._recitePassage(subPassage, story, recitalReactionPromises, purges);
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
  }

  _eventTypeString (innerPassage, submostEventType = innerPassage.type) {
    if (!innerPassage.parentPassage) return submostEventType;
    return `sub-${this._eventTypeString(innerPassage.parentPassage, submostEventType)}`;
  }

  addDelayedRemoveCog (cog, story: Story) {
    story._delayedCogRemovals.push(cog);
  }

  addDelayedFieldUpdate (fieldUpdate: LiveUpdate, story: Story) {
    story._delayedFieldUpdates.add(fieldUpdate);
  }

  _pendingTransactions = {};

  obtainGroupTransaction (groupName: string, {
    setAsGlobal = false,
    finalizer = Promise.resolve(true),
  }: Object = {}) {
    let ret = this._pendingTransactions[groupName];
    if (ret) {
      this.logEvent(1, () => [`obtained existing group transaction '${groupName}'`, ret.debugId()]);
      finalizer.then(() => undefined);
    } else {
      ret = this._pendingTransactions[groupName] = this.discourse.acquireFabricator(groupName);
      this.logEvent(1, () => [
        `created new ${setAsGlobal ? "global " : ""}group transaction '${groupName}'`, ret.debugId()
      ]);
      if (setAsGlobal && (this.discourse.getRootDiscourse() === this.discourse)) {
        // If there is no current transaction as the global discourse
        // set this transaction as the global one.
        this.discourse = ret;
      }
      finalizer.then(() => {
        this.logEvent(1, () => [
          `finalized ${
            !setAsGlobal ? "" : this.discourse === ret ? "still-global " : "no longer global "
          }group transaction '${groupName}'`,
          ret.debugId(),
        ]);
        delete this._pendingTransactions[groupName];
        // If the global discourse is us, revert it back to the root discourse.
        if (this.discourse === ret) this.discourse = ret.getRootDiscourse();
        ret.releaseFabricator();
      });
    }
    return ret;
  }

  getActiveGlobalOrNewLocalEventGroupTransaction = () =>
      ((this.discourse !== this.discourse.getRootDiscourse())
          ? this.discourse
          : this.obtainGroupTransaction("local-events", { setAsGlobal: true, }))

  receiveTruths () {}

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
