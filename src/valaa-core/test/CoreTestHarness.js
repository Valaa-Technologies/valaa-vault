import { OrderedMap } from "immutable";

import type Command from "~/valaa-core/command/Command";
import createRootReducer from "~/valaa-core/tools/createRootReducer";
import createValidateActionMiddleware from "~/valaa-core/redux/middleware/validateAction";
import createProcessCommandIdMiddleware from "~/valaa-core/redux/middleware/processCommandId";
import createProcessCommandVersionMiddleware from
    "~/valaa-core/redux/middleware/processCommandVersion";
import { createBardMiddleware, isRestrictedCommand, createUniversalizableCommand }
    from "~/valaa-core/redux/Bard";

import CoreTestAPI from "~/valaa-core/test/CoreTestAPI";

import Corpus from "~/valaa-core/Corpus";
import Valker from "~/valaa-core/VALK/Valker";

import { dumpObject, invariantify, LogEventGenerator, valaaUUID } from "~/valaa-tools";

const DEFAULT_ACTION_VERSION = "0.1";

export function createCoreTestHarness (options: Object, ...commandBlocks: any) {
  const TestHarness = options.TestHarness || CoreTestHarness;
  const ret = new TestHarness({
    name: "Core Test Harness", ContentAPI: CoreTestAPI,
    ...options,
  });
  commandBlocks.forEach(commandBlock => commandBlock.forEach(command =>
      ret.dispatch(command)));
  return ret;
}

export default class CoreTestHarness extends LogEventGenerator {
  constructor ({ ContentAPI, name, debug, reducerOptions = {}, corpusOptions = {} }) {
    super({ name, debugLevel: debug });
    this.ContentAPI = ContentAPI;
    this.schema = ContentAPI.schema;
    this.reducerOptions = reducerOptions;
    this.corpusOptions = corpusOptions;
    this.corpus = this.createCorpus();
    this.valker = this.createValker();
  }

  getState () { return this.corpus.getState(); }

  /**
   * run always delegates the run to most sophisticated component in the harness.
   * For CoreTestHarness, the target is the corpus.
   *
   * @param {any} rest
   *
   * @memberof CoreTestHarness
   */
  run (...rest) {
    this.valker.setState(this.corpus.getState());
    const ret = this.valker.run(...rest);
    this.corpus.setState(this.valker.getState());
    return ret;
  }

  /**
   * dispatch always delegates the operation to corpus.dispatch (handlings restricted commands is
   * done via .claim, which is not available in core). Also does validation for is-restricted for
   * incoming commands, and for is-universal for resulting stories.
   *
   * @param {any} rest
   *
   * @memberof CoreTestHarness
   */
  dispatch (restrictedCommand: Command) {
    let story;
    try {
      const universalizableCommand = createUniversalizableCommand(restrictedCommand);
      invariantify(isRestrictedCommand(universalizableCommand),
          "universalizable command must still be restricted");
      story = this.corpus.dispatch(universalizableCommand);
      invariantify(!isRestrictedCommand(universalizableCommand),
          "universalized story must not be restricted");
      return story;
    } catch (error) {
      throw this.wrapErrorEvent(error, "Dispatch",
          "\n\trestrictedCommand:", ...dumpObject(restrictedCommand),
          "\n\tstory:", ...dumpObject(story));
    }
  }

  createTestLogger (logger: Logger = console) {
    function dumpifyLogValue (v) { return !v || typeof v !== "object" ? v : dumpify(v); }
    return {
      log: !this.getDebugLevel()
          ? () => {}
          : (...params) => logger.log(...(params.map(dumpifyLogValue))),
      warn: (...params) => logger.warn(...(params.map(dumpifyLogValue))),
      error: (...params) => {
        logger.log(...(params.map(dumpifyLogValue)));
        throw new Error(params.map(dumpifyLogValue).join(", "));
      },
    };
  }

  createCorpus () {
    const reducerName = { name: `${this.getName()} Reducer` };
    const { schema, validators, mainReduce, subReduce } = createRootReducer(Object.freeze({
      ...this.ContentAPI,
      logger: this.createTestLogger(),
      ...(this.reducerOptions || {}),
    }));
    return new Corpus(Object.freeze({
      nameContainer: reducerName,
      initialState: OrderedMap(),
      middlewares: this._createTestMiddlewares({ schema, validators, subReduce }),
      reduce: mainReduce,
      subReduce,
      schema,
      debug: this.getDebugLevel(),
      logger,
      // stubify all unpacked Transient's when packing: this causes them to autorefresh
      ...(this.corpusOptions || {}),
    }));
  }

  createTestMiddleware ({ schema, validators, logger, subReduce }) {
    const previousId = valaaUUID();
    const defaultCommandVersion = DEFAULT_ACTION_VERSION;
    const bardName = { name: `Test Bard` };
    return [
      createProcessCommandVersionMiddleware(defaultCommandVersion),
      createProcessCommandIdMiddleware(previousId, schema),
      createValidateActionMiddleware(validators),
      createBardMiddleware({ name: bardName, schema, logger, subReduce }),
    ];
  }

  createValker () {
    return new Valker(
        this.schema,
        this.getDebugLevel(),
        this,
        value => (value instanceof OrderedMap ? value.get("id") : value),
        value => {
          if (!(value instanceof OrderedMap)) return value;
          const id = value.get("id");
          if (!id || (id.typeof() !== "Resource")) return value;
          return id;
        },
        this.corpusOptions.builtinSteppers,
    );
  }
}
