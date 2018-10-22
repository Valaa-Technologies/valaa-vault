import { OrderedMap } from "immutable";

import type Command from "~/raem/command/Command";
import createRootReducer from "~/raem/tools/createRootReducer";
import createValidateActionMiddleware from "~/raem/redux/middleware/validateAction";
import createProcessCommandIdMiddleware from "~/raem/redux/middleware/processCommandId";
import createProcessCommandVersionMiddleware from
    "~/raem/redux/middleware/processCommandVersion";
import { createBardMiddleware, isRestrictedCommand, createUniversalizableCommand }
    from "~/raem/redux/Bard";

import RAEMTestAPI from "~/raem/test/RAEMTestAPI";

import Corpus from "~/raem/Corpus";
import Valker from "~/raem/VALK/Valker";

import { dumpObject, invariantify, LogEventGenerator, valaaUUID, wrapError } from "~/tools";

const DEFAULT_ACTION_VERSION = "0.1";

export function createRAEMTestHarness (options: Object, ...proclamationBlocks: any) {
  try {
    const TestHarness = options.TestHarness || RAEMTestHarness;
    const ret = new TestHarness({
      name: "RAEM Test Harness", ContentAPI: RAEMTestAPI,
      ...options,
    });
    proclamationBlocks.forEach(proclamations => proclamations.forEach(proclamation =>
        ret.dispatch(proclamation)));
    return ret;
  } catch (error) {
    throw wrapError(error, new Error("During createProphetTestHarness"),
        "\n\toptions:", ...dumpObject(options),
        "\n\tproclamationBlocks:", ...dumpObject(proclamationBlocks));
  }
}

export default class RAEMTestHarness extends LogEventGenerator {
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
   * For RAEMTestHarness, the target is the corpus.
   *
   * @param {any} rest
   *
   * @memberof RAEMTestHarness
   */
  run (...rest) {
    this.valker.setState(this.corpus.getState());
    const ret = this.valker.run(...rest);
    this.corpus.setState(this.valker.getState());
    return ret;
  }

  /**
   * dispatch always delegates the operation to corpus.dispatch (handlings restricted commands is
   * done via .proclaim, which is not available in @valos/raem). Also does validation for
   * is-restricted for incoming commands, and for is-universal for resulting stories.
   *
   * @param {any} rest
   *
   * @memberof RAEMTestHarness
   */
  dispatch (proclamation: Command) {
    let story;
    try {
      const universalizableCommand = createUniversalizableCommand(proclamation);
      invariantify(isRestrictedCommand(universalizableCommand),
          "universalizable command must still be restricted");
      story = this.corpus.dispatch(universalizableCommand);
      invariantify(!isRestrictedCommand(universalizableCommand),
          "universalized story must not be restricted");
      return story;
    } catch (error) {
      throw this.wrapErrorEvent(error, "Dispatch",
          "\n\trestrictedCommand:", ...dumpObject(proclamation),
          "\n\tstory:", ...dumpObject(story));
    }
  }

  createCorpus () {
    const { schema, validators, mainReduce, subReduce } = createRootReducer(Object.freeze({
      ...this.ContentAPI,
      logEventer: this,
      ...(this.reducerOptions || {}),
    }));
    return new Corpus(Object.freeze({
      name: `${this.getName()} Corpus`,
      initialState: OrderedMap(),
      middlewares: this._createTestMiddlewares({ schema, validators }),
      reduce: mainReduce,
      subReduce,
      schema,
      debugLevel: this.getDebugLevel(),
      logger: this.getLogger(),
      // stubify all unpacked Transient's when packing: this causes them to autorefresh
      ...(this.corpusOptions || {}),
    }));
  }

  _createTestMiddlewares ({ schema, validators }) {
    const previousId = valaaUUID();
    const defaultCommandVersion = DEFAULT_ACTION_VERSION;
    return [
      createProcessCommandVersionMiddleware(defaultCommandVersion),
      createProcessCommandIdMiddleware(previousId, schema),
      createValidateActionMiddleware(validators),
      createBardMiddleware(),
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
