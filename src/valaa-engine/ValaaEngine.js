import omit from "lodash/omit";
import { Iterable } from "immutable";

import VALEK, { Kuery, VALKOptions, dumpObject, rootScopeSelf,
  builtinSteppers as engineBuiltinSteppers,
} from "~/valaa-engine/VALEK";

import Command, { created, duplicated, recombined, isCreatedLike } from "~/valaa-core/command";

import { VRef, vRef, IdData, obtainVRef, getRawIdFrom } from "~/valaa-core/ValaaReference";
import { createPartitionURI } from "~/valaa-core/tools/PartitionURI";

import Transient, { createTransient, getTransientTypeName }
    from "~/valaa-core/tools/denormalized/Transient";
import { isGhost } from "~/valaa-core/tools/denormalized/ghost";
import layoutByObjectField from "~/valaa-core/tools/denormalized/layoutByObjectField";

import type { Prophet } from "~/valaa-prophet";

import Cog, { executeHandlers } from "~/valaa-engine/Cog";
import Motor from "~/valaa-engine/Motor";
import Vrapper from "~/valaa-engine/Vrapper";
import evaluateToCommandData from "~/valaa-engine/Vrapper/evaluateToCommandData";

import { createId, dumpify, outputCollapsedError, wrapError } from "~/valaa-tools";

import { getAllMediaInterpreters } from "~/valaa-engine/interpreter";
import PlainTextMediaInterpreter from "~/valaa-engine/interpreter/PlainTextMediaInterpreter";

import type MediaInterpreter from "~/valaa-engine/interpreter/MediaInterpreter";

export default class ValaaEngine extends Cog {

  _mediaInterpreters: Array<MediaInterpreter>;
  _defaultMediaInterpreter: MediaInterpreter;

  constructor ({ name, logger, prophet, timeDilation = 1.0, debug }: Object) {
    super({ name: `${name}/Engine`, logger });
    this.engine = this;
    this.prophet = prophet;
    this.cogs = new Set();
    this._vrappers = new Map();
    this._prophecyHandlerRoot = new Map();
    this._prophecyHandlerRoot.set("rawId", this._vrappers);
    this.debug = debug || 0;

    this.addCog(this);
    this.motor = new Motor({ engine: this, name: `${name}/Motor`, prophet, timeDilation });
    this.addCog(this.motor);

    this._defaultMediaInterpreter = new PlainTextMediaInterpreter();
    this._mediaInterpreters = getAllMediaInterpreters();
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
      const transient = Iterable.isKeyed(value) ? value : undefined;
      const id = (typeof transient !== "undefined") ? transient.get("id")
          : value instanceof VRef ? value
          : undefined;
      // FIXME: obtain vrapper for data objects? VRef/DRef/BRef can be used for this.
      if (!id) return Iterable.isIterable(value) ? value.toJS() : value;
      return this.getVrapper(id, { state: valker.getState() }, transient);
    });
    ret.setBuiltinSteppers(engineBuiltinSteppers);
    return ret;
  }

  interpretMediaContent (content: any, vScope: Vrapper,
      mediaInfo: { type: string, subtype: string }, options: VALKOptions = {}) {
    let interpreter = this._mediaInterpreters.find(i => i.canInterpret(mediaInfo));
    if (!interpreter) {
      interpreter = this._defaultMediaInterpreter;
    }
    return interpreter.interpret(content, vScope, mediaInfo, options);
  }

  getSelfAsHead () {
    return this._enginePartitionId ? vRef(this._enginePartitionId) : {};
  }

  getRootScope () { return this._rootScope; }
  getLexicalScope () { return this.getRootScope(); }
  getNativeGlobal () { return this.getRootScope(); }
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
      cog.registerHandlers(this._prophecyHandlerRoot);
    }
  }

  removeCog (cog) {
    if (this.cogs.delete(cog)) {
      cog.unregisterHandlers(this._prophecyHandlerRoot);
    }
  }

  delayedRemoveCog (cog) {
    (this.delayedCogRemovals || (this.delayedCogRemovals = [])).push(cog);
  }
  delayedCogRemovals: Cog[];

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
        typeName = state.getIn(["ResourceStub", rawId]);
        if (typeName) {
          transient = state.getIn([typeName, rawId]);
        } else if (!isGhost(idData)) {
          if (options.optional) return undefined;
          throw new Error(`Cannot find non-ghost ${idData}:ResourceStub from state`);
        } else {
          typeName = state.getIn(["ResourceStub", idData.getGhostPath().rootRawId()]);
          if (typeName) {
            transient = createTransient({ id: idData, typeName });
          } else {
            if (options.optional) return undefined;
            throw new Error(`Cannot find ghost ${idData}:ResourceStub root ${
                idData.getGhostPath().rootRawId()}:ResourceStub from state`);
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

  create (typeName: string, initialState: Object, options: Object) {
    return this._constructWith(created,
        { initialState, typeName },
        options,
        () => ({ typeName }),
        (constructParams, id, evaluatedInitialState) => {
          constructParams.id = id;
          constructParams.initialState = evaluatedInitialState;
        });
  }

  duplicate (duplicateOf: Vrapper, initialState: Object, options: Object) {
    return this._constructWith(duplicated,
        { initialState, typeName: duplicateOf.getTypeName() },
        options,
        (innerOptions) => ({ duplicateOf: evaluateToCommandData(duplicateOf, innerOptions) }),
        (constructParams, id, evaluatedInitialState) => {
          constructParams.id = id;
          constructParams.initialState = evaluatedInitialState;
        });
  }

  recombine (duplicationDirectives: Object, options: Object) {
    return this._constructWith(recombined,
        duplicationDirectives,
        options,
        () => ({ actions: [] }),
        (constructParams, id, evaluatedInitialState, directive, innerOptions) => {
          constructParams.actions.push(duplicated({
            id,
            duplicateOf: evaluateToCommandData(directive.duplicateOf, innerOptions),
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
          evaluateToCommandData(directive.initialState, options),
          directive,
          options);
      }

      result = transaction.claim(constructCommand(constructParams));

      // FIXME(iridian): If the transaction fails the Vrapper will contain inconsistent data until
      // the next actual update on it.

      ret = directiveArray.map((directive, index) => {
        if (directive.initialState && directive.initialState.partitionAuthorityURI) {
          // Create partition(s) before the transaction is committed (and thus before the command
          // leaves upstream).
          this._createNewPartition(directive);
        }
        const id = isRecombine
            ? result.prophecy.passage.passages[index].id
            : result.prophecy.passage.id;
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
    this.engine.prophet.acquirePartitionConnection(
        directive.id.partitionURI(), { createNewPartition: true });
  }

  _resolveIdForConstructDirective (directive, options: VALKOptions,
      typeName: string) {
    const initialState = directive.initialState || {};
    const id = obtainVRef(options.id || initialState.id || createId({ typeName, initialState }));
    let partitionURI;
    delete initialState.id;
    if (initialState.partitionAuthorityURI) {
      partitionURI = createPartitionURI(initialState.partitionAuthorityURI, id.rawId());
    } else if (initialState.owner || initialState.source) {
      partitionURI = evaluateToCommandData(initialState.owner || initialState.source, options)
          .partitionURI();
    }
    directive.id = !partitionURI ? id : id.immutatePartitionURI(partitionURI);
    return directive.id;
  }

  outputStatus (output = console) {
    output.log(`${this.name}: Resources:`,
        layoutByObjectField(this.prophet.getState(), "name"));
    output.log(`${this.name}: Handlers:`, this._prophecyHandlerRoot);
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

  revealProphecy (prophecy) {
    const { passage, timed, state, previousState } = prophecy;
    if (this.debug || timed) {
      this.logEvent(`revealProphecy`, eventTypeString(passage),
          (timed ? `@ ${timed.startTime || "|"}->${timed.time}:` : ":"),
          dumpify(omit(passage, ["parentPassage", "passages", "type"])));
    }
    function eventTypeString (innerPassage, submostEventType = innerPassage.type) {
      if (!innerPassage.parentPassage) return submostEventType;
      return `sub-${eventTypeString(innerPassage.parentPassage, submostEventType)}`;
    }
    passage.timedness = timed ? "Timed" : "Timeless";
    const alreadyExecutedHandlers = new Set();
    let vResource;
    try {
      if (passage.id) {
        passage.rawId = getRawIdFrom(passage.id);
        const existingVrapper = this._vrappers.get(passage.rawId);
        if (existingVrapper && existingVrapper.get(null)) vResource = existingVrapper.get(null)[0];
        if (isCreatedLike(passage)) {
          if (!existingVrapper) {
            vResource = new Vrapper(this, obtainVRef(passage.id), passage.typeName);
          } else vResource._setTypeName(passage.typeName);
          if (vResource.isResource()) {
            Promise.resolve(vResource.activate(state))
                .then(undefined, (error) => {
                  outputCollapsedError(localWrapError(this, error,
                      `revealProphecy(${passage.type} ${vResource.debugId()}).activate`));
                });
          }
        }
      }
      let promises = executeHandlers(this._prophecyHandlerRoot, passage,
          alreadyExecutedHandlers, [vResource, prophecy]);
      if (passage.passages) {
        const subProphecy = { timed, state, previousState };
        passage.passages.forEach(subPassage => {
          subProphecy.passage = subPassage;
          const subPromises = this.revealProphecy(subProphecy);
          if (subPromises) (promises || (promises = [])).push(subPromises);
        });
      }
      if (this.delayedCogRemovals) {
        this.delayedCogRemovals.forEach(cog => this.removeCog(cog));
        this.delayedCogRemovals = null;
      }
      return promises;
    } catch (error) {
      throw localWrapError(this, error, `revealProphecy(${passage.type} ${
              vResource ? vResource.debugId() : ""})`,
          "\n\tprophecy state:", state && state.toJS(),
          "\n\tprophecy previousState:", prophecy.previousState && prophecy.previousState.toJS());
    }
    function localWrapError (self, error, operationName, ...extraContext) {
      return self.wrapErrorEvent(error, operationName,
          "\n\tprophecy passage:", passage,
          "\n\tprophecy vResource:", vResource,
          "\n\tprophecy:", prophecy,
          ...extraContext);
    }
  }

  confirmTruth (/* authorizedEvent */) {
    // console.log("TRUTH Confirmed", truthEvent);
  }

  rejectHeresy (/* rejectedCommand, purgedCorpus, revisedEvents */) {
    // console.log("HERECY Rejected", rejectedCommand);
  }

  start () { return this.motor.start(); }
  setTimeOrigin (timeOrigin) { return this.motor.setTimeOrigin(timeOrigin); }
  isPaused () { return this.motor.isPaused(); }
  setPaused (value = true) { return this.motor.setPaused(value); }
  getTimeDilation () { return this.motor.getTimeDilation(); }
  setTimeDilation (timeDilation) { return this.motor.setTimeDilation(timeDilation); }
}
