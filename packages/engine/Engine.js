// @flow

import { Iterable } from "immutable";
import type { Passage, Story, VALKOptions } from "~/raem";
import { packedSingular } from "~/raem/VALK";

import { rootScopeSelf } from "~/script";

import { Kuery, dumpObject, engineSteppers } from "~/engine/VALEK";

import { Command, duplicated, isCreatedLike } from "~/raem/events";

import VRL, { vRef, IdData, getRawIdFrom } from "~/raem/VRL";
import { tryHostRef, getHostRef } from "~/raem/VALK/hostReference";
import { getActionFromPassage } from "~/raem/redux/Bard";
import { formVPlot, coerceAsVRID, validateVRID, validateVVerbs } from "~/plot";
import { naiveURI } from "~/raem/ValaaURI";

import Transient, { createTransient, getTransientTypeName } from "~/raem/state/Transient";
import layoutByObjectField from "~/raem/tools/denormalized/layoutByObjectField";

import type { Sourcerer } from "~/sourcerer";
import { StoryRecital } from "~/sourcerer/FalseProphet/StoryRecital";

import Cog, { executeHandlers } from "~/engine/Cog";
import Motor from "~/engine/Motor";
import Vrapper from "~/engine/Vrapper";
import integrateDecoding from "~/engine/Vrapper/integrateDecoding";
import LiveUpdate from "~/engine/Vrapper/LiveUpdate";
import Subscription from "~/engine/Vrapper/Subscription";

import { thenChainEagerly } from "~/tools";

export default class Engine extends Cog {
  constructor ({ name, parent, sourcerer, timeDilation = 1.0, verbosity, discourse }: Object) {
    super(parent, verbosity, `${name}/Engine`);
    this._sourcerer = sourcerer;
    this._cogs = new Set();
    this._vrappers = new Map();
    this._storyHandlerRoot = new Map();
    this._storyHandlerRoot.set("rawId", this._vrappers);

    this.addCog(this);
    this._motor = new Motor(this, `${name}/Motor`, timeDilation);
    this.addCog(this._motor);
    this.discourse = this._connectWithSourcerer(sourcerer, discourse);
    this._currentPassageCounter = 0;
    this._hostDescriptors = new Map();
    this._rootScope = {};
    this._rootScope[rootScopeSelf] = this._rootScope;
  }

  getEngine () { return this; }

  _connectWithSourcerer (sourcerer: Sourcerer, discourseOptions: Object = {}) {
    const ret = sourcerer.addFollower(this, {
      verbosity: this.getVerbosity() - 1,
      ...discourseOptions,
    });
    ret.setHostValuePacker(packFromHost);
    function packFromHost (value) {
      if (value instanceof Vrapper) {
        return packedSingular(value.getVRef(), value._type.name || "TransientFields");
      }
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

  getVRef () { return this._engineChronicleId ? vRef(this._engineChronicleId) : {}; }
  getSourcerer () { return this._sourcerer; }

  getRootScope () { return this._rootScope; }
  getValospaceScope () { return this.getRootScope(); }
  getFabricScope () { return this.getRootScope(); }
  getHostDescriptors () { return this._hostDescriptors; }
  getHostObjectDescriptor (hostObjectId: any) { return this._hostDescriptors.get(hostObjectId); }
  getValospaceType (typeName) { return this._rootScope.valos[typeName]; }

  setRootScopeEntry (entryName: string, value: any) {
    this._rootScope[entryName] = value;
  }

  getIdentityMediator () { return this._rootScope.valos.identity; }

  run (head: any, kuery: Kuery, options: VALKOptions = {}) {
    if (options.scope === undefined) options.scope = this.getRootScope();
    return super.run(head, kuery, options);
  }

  addCog (cog) {
    if (!this._cogs.has(cog)) {
      this._cogs.add(cog);
      cog.registerHandlers(this._storyHandlerRoot);
    }
  }

  removeCog (cog) {
    if (this._cogs.delete(cog)) {
      cog.unregisterHandlers(this._storyHandlerRoot);
    }
  }

  valosRequire (module: string | symbol) {
    return this._parent._parent.valosRequire(module);
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
    const vExisting = (idData instanceof Vrapper) ? idData : this.tryVrapper(idData);
    let typeName = options.typeName;
    if (vExisting) {
      if (typeName && (typeName !== vExisting._type.name)) {
        vExisting._setType(this.getValospaceType(typeName));
      }
      return vExisting;
    }
    let transient;
    const discourse = options.discourse || this.discourse;
    const state = options.state || discourse.getState();
    const id = discourse.obtainReference(idData, options.contextChronicleURI);
    try {
      if (explicitTransient) {
        typeName = getTransientTypeName(explicitTransient, discourse.schema);
        transient = explicitTransient;
      } else {
        const rawId = id.rawId();
        if (!typeName) typeName = state.getIn(["TransientFields", rawId]);
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
      return new Vrapper(this,
          transient.get("id"), this.getValospaceType(typeName), [state, transient]);
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, () => [
        `getVrapper(${idData})`,
        "\n\tidData:", ...dumpObject(idData),
        "\n\tid:", ...dumpObject(id),
        "\n\ttypeName:", ...dumpObject(typeName),
        "\n\texplicitTransient:", ...dumpObject(explicitTransient),
        "\n\ttransient:", ...dumpObject(transient),
        "\n\tstate:", ...dumpObject(state && state.toJS()),
      ]);
    }
  }

  getVrapperByRawId (rawId: string, options: VALKOptions, explicitTransient: Transient) {
    return this.getVrapper((new VRL()).initNSS(rawId), options, explicitTransient);
  }

  getVrappers (idSequence: IdData[], options: VALKOptions = {}) {
    const ret = [];
    idSequence.forEach(idData => { ret.push(this.getVrapper(idData, options)); });
    return ret;
  }

  async activateResource (resourceURI: string) {
    if (!resourceURI) return { reference: null, vResource: null };
    const vref = this.discourse.obtainReference(resourceURI);
    const connection = await this.discourse
        .sourcerChronicle(vref.getChronicleURI())
        .asSourceredConnection();
    const vResource = await this.getVrapperByRawId(vref.rawId() || connection.getChronicleId());
    await vResource.activate();
    return { reference: vref, vResource };
  }

  duplicate (duplicateOf: Vrapper, initialState: Object, options: Object): Vrapper {
    return this.create(duplicateOf.getTypeName(), initialState, options, duplicateOf);
  }

  create (typeName, initialState, options: Object = {}, duplicateOf: ?Vrapper) {
    let discourse, releaseOpts, extractedProperties, ret;
    const name = `${duplicateOf ? "duplicate-" : "new-"}${typeName}`;
    const action = !duplicateOf
        ? { type: "CREATED", typeName }
        : { type: "DUPLICATED", duplicateOf };
    try {
      options.discourse = discourse = (options.discourse || this.discourse)
          .acquireFabricator(name);
      extractedProperties = this._extractProperties(initialState);
      const id = action.id = this._assignConstructDirectiveId({ initialState, typeName }, options);
      if (initialState) action.initialState = initialState;

      options.proclamation = discourse.proclaimEvent(action);

      ret = this._postConstructResource(discourse, id,
          action.initialState, options.proclamation.story, extractedProperties, localWrapError);
    } catch (error) {
      releaseOpts = { rollback: error };
      throw localWrapError(this, error, name);
    } finally {
      if (discourse) discourse.releaseFabricator(releaseOpts);
    }
    return !options.awaitResult ? ret
        : thenChainEagerly(options.awaitResult(options.proclamation, ret), () => ret);

    function localWrapError (self, error, operationName) {
      return self.wrapErrorEvent(error, operationName,
          "\n\tinitialState:", ...dumpObject(initialState),
          "\n\toptions:", ...dumpObject(options),
          "\n\taction:", ...dumpObject(action),
          "\n\textractedProperties:", ...dumpObject(extractedProperties),
          "\n\tproclamation:", ...dumpObject(options.proclamation),
          "\n\tproclamation event:", ...dumpObject((options.proclamation || {}).event),
          "\n\tret:", ...dumpObject(ret),
      );
    }
  }

  recombine (duplicationDirectives: Object, options: Object = {}) {
    const recombinedEvent = { type: "RECOMBINED", actions: [] };
    let discourse, releaseOpts, proclamation, ret;
    const extractedProperties = [];
    try {
      options.discourse = discourse = (options.discourse || this.discourse)
          .acquireFabricator(`recombine-${duplicationDirectives.length}`);

      for (const directive of duplicationDirectives) {
        extractedProperties.push(this._extractProperties(directive.initialState));
        recombinedEvent.actions.push(duplicated({
          id: this._assignConstructDirectiveId(directive, options),
          duplicateOf: directive.duplicateOf,
          initialState: directive.initialState,
        }));
      }

      proclamation = discourse.proclaimEvent(recombinedEvent);

      // FIXME(iridian): If the transaction fails the Vrapper will
      // contain inconsistent data until the next actual update on it.

      ret = duplicationDirectives.map((directive, index) =>
          this._updateResourceThing(discourse, directive.id, directive.initialState,
            proclamation.story.passages[index], extractedProperties[index], localWrapError));
    } catch (error) {
      releaseOpts = { rollback: error };
      throw localWrapError(this, error, `recombined()`);
    } finally {
      discourse.releaseFabricator(releaseOpts);
    }
    return !options.awaitResult ? ret
          : thenChainEagerly(options.awaitResult(proclamation, ret), () => ret);
    function localWrapError (self, error, operationName) {
      return self.wrapErrorEvent(error, operationName,
          "\n\tduplication directives:", ...dumpObject(duplicationDirectives),
          "\n\toptions:", ...dumpObject(options),
          "\n\trecombined:", ...dumpObject(recombinedEvent),
          "\n\textractedProperties:", ...dumpObject(extractedProperties),
          "\n\tproclamation:", ...dumpObject(proclamation),
          "\n\tproclamation event:", ...dumpObject((proclamation || {}).event),
          "\n\tret:", ...dumpObject(ret),
      );
    }
  }

  _extractProperties (initialState: Object) {
    if (!initialState ||
        (typeof initialState.properties !== "object") ||
        initialState.properties === null ||
        Array.isArray(initialState.properties)) {
      return undefined;
    }
    const ret = initialState.properties;
    delete initialState.properties;
    return ret;
  }

  _postConstructResource (
      discourse, id, initialState, resultPassage, extractedProperties, localWrapError) {
    if ((initialState || {}).authorityURI) {
      // Create chronicle(s) before the transaction is committed
      // (and thus before the commands leave upstream).
      Promise.resolve(discourse
              .sourcerChronicle(id.getChronicleURI(), { newChronicle: true })
              .asSourceredConnection())
          .catch(error => {
            this.outputErrorEvent(
                localWrapError(this, error, `_construct.sourcerChronicle ${id.getChronicleURI()}`),
                0,
                `Exception caught during new chronicle sourcery for root ${id}`);
          });
    }
    // FIXME(iridian): If the transaction fails the Vrapper will
    // contain inconsistent data until the next actual update on it.
    const vResource = this.getVrapper(
        resultPassage.id, { discourse, typeName: resultPassage.typeName });
    if (vResource.isResource()) {
      const state = discourse.getState();
      const initialBlocker = vResource.refreshPhase(state);
      if (initialBlocker) {
        Promise.resolve(vResource.activate({ state, allowImmaterial: true, initialBlocker }))
            .catch((error) => {
              this.outputErrorEvent(
                  localWrapError(this, error, `_construct.activate ${vResource.debugId()}`),
                  1,
                  `Exception caught during resource construction activate of ${
                      vResource.debugId()}`);
            });
      }
    }
    if (extractedProperties) {
      vResource.assignProperties(extractedProperties, {
        discourse, updateExisting: !!(initialState.instancePrototype || initialState.prototype),
      });
    }
    return vResource;
  }

  _assignConstructDirectiveId (directive, options: VALKOptions) {
    const discourse = options.discourse;
    const initialState = directive.initialState || {};

    let explicitId = options.id || initialState.id;
    delete initialState.id;
    if (initialState.partitionAuthorityURI) {
      throw new Error("partitionAuthorityURI is deprecated");
    }
    let subPlot;
    if (initialState.fixed) {
      subPlot = this.subPlotFromFixedFields(
          initialState.fixed, directive.typeName, initialState);
      delete initialState.fixed;
    }
    const authorityURI = initialState.authorityURI;
    /* Allowed combinations of id, sub, owner, aur
      0:              : no, must have owner or be chronicle root
      1: id,          : no, must have owner or be chronicle root
      2:     sub,     : no, must have owner or be chronicle root
      3: id, sub,     : no, must have owner or be chronicle root
      4:          auri: yes, generated chronicle root id
      5: id,      auri: yes, explicit chronicle root id
      6:     sub, auri: no, sub parent must exist
      7: id, sub, auri: no, sub parent must be the owner
      // cases 8-f listed below
     */
    if (explicitId) {
      // cases 3, 7, b, f
      if (subPlot) throw new Error("Can't have both explicit id and fixed fields");
      if (Array.isArray(explicitId)) {
        explicitId = formVPlot(explicitId);
        if (explicitId[1] !== "$") throw new Error("explicit VRID must have a GRId as first step");
      } else if (explicitId instanceof VRL) {
        return directive.id = explicitId;
      } else if (typeof explicitId !== "string") {
        throw new Error("explicit id must be either a string or a VPlot steps array");
      } else if (explicitId[0] === "@") {
        validateVRID(explicitId);
      } else {
        this.debugEvent("DEPRECATED non-vplot format id:", explicitId,
            "\n\tcoerced as VRID:", coerceAsVRID(explicitId));
        explicitId = coerceAsVRID(explicitId);
      }
    }
    const owner = initialState.owner || initialState.source;
    if (!owner) {
      if (subPlot) throw new Error("Can't have fixed fields without owner"); // cases 2, 6
      if (authorityURI) { // cases 4, 5
        return discourse.assignNewChronicleRootId(directive, authorityURI, explicitId);
      }
      // cases 0, 1, (2, 3 already handled)
      // throw new Error("new resource must have either owner or authorityURI");
      // This is legacy stuff, but removing this might break things.
      return discourse.assignNewUnchronicledVRID(directive, explicitId);
    }
    /*
      8:                owner: yes, global resource id
      9: id,            owner: yes, global explicit id
      a:     sub,       owner: yes, fixed id with owner as sub parent
      b: id, sub,       owner: no, both owner and explicit id can't be the sub parent
      c:          auri, owner: future (with multi-chronicle tx), generated chronicle id
      d: id,      auri, owner: future (with multi-chronicle tx), explicit chronicle id
      e:     sub, auri, owner: future (with multi-chronicle tx), fixed id, owner as sub parent
      f: id, sub, auri, owner: no, both owner and explicit id can't be the sub parent
    */
    const chronicleURI = this.getChronicleURIOf(getHostRef(owner), discourse);
    // cases 8, 9, a, c, d, e
    // naiveURI.validateChronicleURI(chronicleURI);
    if (subPlot) { // case a -> 9, e -> d
      if (Array.isArray(subPlot)) subPlot = formVPlot(subPlot);
      else validateVVerbs(subPlot);
      if (subPlot[1] === "$") {
        throw new Error("explicit fixed id must not have a GRId as first step");
      }
    }
    return discourse.assignNewVRID(directive, String(chronicleURI), explicitId, subPlot);
  }

  subPlotFromFixedFields (fixed: Object, typeName: ?string, initialState: ?Object) {
    const ret = !fixed.id ? [Vrapper.typeKeys[typeName || fixed.typeName] || "@_"]
        : Array.isArray(fixed.id) ? [...fixed.id]
        : [fixed.id];
    if (fixed.name) {
      if (initialState) initialState.name = fixed.name;
      ret.push(fixed.name);
    }
    for (const key of Object.getOwnPropertyNames(fixed).sort()) {
      if (key === "name" || key === "id" || key === "params" || key === "typeName") continue;
      if (initialState) initialState[key] = fixed[key];
      ret.push(this._asStep(key, fixed[key]));
    }
    for (const symbol of Object.getOwnPropertySymbols(fixed)) {
      if (initialState) initialState[symbol] = fixed[symbol];
      ret.push(this._asStep(symbol, fixed[symbol]));
    }
    if (fixed.params) {
      if (Array.isArray(fixed.params)) ret.push(...fixed.params);
      else ret.push(fixed.params);
    }
    return ret;
  }

  _asStep (name, value) {
    const ref = tryHostRef(value);
    return ["@.", [
      typeof name === "string" ? ["@$V", name] : name,
      ref ? [ref.vrid()] : value,
    ]];
  }

  getChronicleURIOf (vref, discourse, require) {
    let chronicleURI = vref.getChronicleURI();
    if (!chronicleURI && vref.isGhost()) {
      const nonGhostOwnerRawId = vref.getGhostPath().headHostRawId() || vref.rawId();
      const transient = (discourse || this.discourse)
          .tryGoToTransientOfRawId(nonGhostOwnerRawId, "Resource");
      if (transient) {
        chronicleURI = transient && transient.get("id").getChronicleURI();
        if (!chronicleURI) {
          const authorityURI = transient.get("authorityURI")
              || transient.get("partitionAuthorityURI");
          chronicleURI = authorityURI
              && naiveURI.createChronicleURI(authorityURI, transient.get("id").rawId());
        }
      }
      /*
      {
        chronicleURI = (discourse || this.discourse)
            .bindObjectId([vref.getGhostPath().headHostRawId()], "Resource")
            .getChronicleURI();
      }
      */
      if ((require !== false) && !chronicleURI) {
        throw new Error("INTERNAL ERROR: could not determine new resource chronicle");
      }
    }
    return chronicleURI;
  }

  outputStatus (output = console) {
    output.log(`${this.name}: Resources:`,
        layoutByObjectField(this.getSourcerer().getState(), "name"));
    output.log(`${this.name}: Handlers:`, this._storyHandlerRoot);
    output.log(`${this.name}: Cogs:`);
    for (const cog of this._cogs) if (cog !== this) cog.outputStatus(output);
  }

  requestFullScreen () {
    // TODO(iridian): This should happen through sourcerer to reach the cogs in uniform
    // manner.
    for (const cog of this._cogs) {
      if (cog !== this && cog.requestFullScreen) cog.requestFullScreen();
    }
  }

  receiveCommands (stories: Command[], purgedRecital: ?StoryRecital, purgedProtagonists: ?Set) {
    const recitalReactionPromises = !purgedProtagonists && [];
    let finalizeReceiveCommandsTransaction;
    const finalizeTrigger = { then (callback) { finalizeReceiveCommandsTransaction = callback; } };
    const tx = !purgedProtagonists
        && this.obtainGroupTransaction("receiveCommands", finalizeTrigger);
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
    this.logEvent(2, () => [
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
        this.outputErrorEvent(error, 1,
            "Exception caught during Engine.receiveCommands recital");
      }
    }
    this.logEvent(2, () => [
      !purgedProtagonists ? "recited" : "purged", stories.length, "stories in", tx && tx.debugId(),
    ]);
    if (purgedProtagonists) return purgedProtagonists;
    finalizeReceiveCommandsTransaction(true);
    return recitalReactionPromises.length ? recitalReactionPromises : undefined;
  }

  _recitePassage (passage: Passage, story: Story, recitalReactionPromises, purges: ?Set) {
    passage.timedness = story.timed ? "Timed" : "Timeless";
    passage._counter = ++this._currentPassageCounter;
    if (this.getVerbosity()) {
      // eslint-disable-next-line
      const { parentPassage, passages, type, state, previousState, next, prev, ...rest } = passage;
      this.logEvent(passage !== story ? 3 : 2, () => [
        passage !== story ? "recitePassage" : "reciteStory", `#${this._currentPassageCounter}`,
        `#${story.storyIndex}/${passage.passageIndex}`,
        this._eventTypeString(passage), ...[passage.typeName].filter(p => p), String(passage.id),
        (story.timed ? `@ ${story.timed.startTime || "|"}->${story.timed.time}:` : ":"),
        "\n\taction:", ...dumpObject(getActionFromPassage(passage)),
        "\n\tpassage:", ...dumpObject(passage),
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
              passage.vProtagonist = new Vrapper(
                  this, passage.id, this.getValospaceType(passage.typeName));
            } else if (passage.vProtagonist._type.name !== passage.typeName) {
              passage.vProtagonist._setType(this.getValospaceType(passage.typeName));
            }
            if (passage.vProtagonist.isResource()) {
              const blocker = passage.vProtagonist.refreshPhase(story.state);
              if (blocker !== undefined) {
                Promise.resolve(blocker).then(undefined, (error) => {
                  this.outputErrorEvent(
                      errorOnReceiveCommands.call(this, error,
                          `receiveCommands(${passage.type} ${
                            passage.vProtagonist.debugId()}).refreshPhase`),
                      2,
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
            passage.vProtagonist ? passage.vProtagonist.debugId() : passage.typeName})`));
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

  obtainGroupTransaction (groupName: string, finalizeTrigger?: () => any) {
    let ret = this._pendingTransactions[groupName];
    if (ret) {
      this.logEvent(2, () => [`obtained existing group transaction '${groupName}'`, ret.debugId()]);
      if (finalizeTrigger) finalizeTrigger.then(() => undefined);
    } else {
      if (this.discourse.groupName) {
        this._releaseGroupTransaction(this.discourse, `superseded by ${groupName}`);
      }
      ret = this._pendingTransactions[groupName] =
          this.discourse.acquireFabricator(`group-${groupName}`);
      ret.groupName = groupName;
      const isGlobal = this.trySetAsGlobalDiscourse(ret);
      this.logEvent(2, () => [
        `created new`, isGlobal ? "global " : "", `group transaction '${groupName}'`, ret.debugId(),
      ]);
      (finalizeTrigger || Promise.resolve(true))
          .then(() => this._releaseGroupTransaction(ret, "finalized"));
    }
    return ret;
  }

  _releaseGroupTransaction (groupTransaction, reason) {
    if (!groupTransaction.groupName) return;
    const isGlobal = this.discourse === groupTransaction;
    if (isGlobal) {
      this.discourse = groupTransaction.getRootDiscourse();
      this.logEvent(2, () => [
        `relinguished global group transaction '${groupTransaction.groupName}':`, reason,
      ]);
    }
    delete this._pendingTransactions[groupTransaction.groupName];
    groupTransaction.groupName = null;
    groupTransaction.releaseFabricator();
  }

  trySetAsGlobalDiscourse (discourse) {
    if (this.discourse !== this.discourse.getRootDiscourse()) return false;
    this.discourse = discourse;
    return true;
  }

  resetGlobalDiscourseIfEqualTo (discourse) {
    if (this.discourse === discourse) this.discourse = discourse.getRootDiscourse();
  }

  getSubscriptionTransaction = () =>
      ((this.discourse !== this.discourse.getRootDiscourse())
          ? this.discourse
          : this.obtainGroupTransaction("subscription"));

  receiveTruths () {}

  start () { return this._motor.start(); }
  setTimeOrigin (timeOrigin) { return this._motor.setTimeOrigin(timeOrigin); }
  isPaused () { return this._motor.isPaused(); }
  setPaused (value = true) { return this._motor.setPaused(value); }
  getTimeDilation () { return this._motor.getTimeDilation(); }
  setTimeDilation (timeDilation) { return this._motor.setTimeDilation(timeDilation); }

  _integrateDecoding (...rest: any[]) {
    return integrateDecoding(...rest);
  }
}
