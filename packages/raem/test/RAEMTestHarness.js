import { OrderedMap } from "immutable";

import type { EventBase } from "~/raem/events";
import createRootReducer from "~/raem/tools/createRootReducer";
import createValidateEventMiddleware from "~/raem/redux/middleware/validateEvent";
import createProcessCommandVersionMiddleware from
    "~/raem/redux/middleware/processCommandVersion";
import { createBardMiddleware } from "~/raem/redux/Bard";

import RAEMTestAPI from "~/raem/test/RAEMTestAPI";

import Corpus from "~/raem/Corpus";
import Valker from "~/raem/VALK/Valker";

import { dumpObject, LogEventGenerator, wrapError } from "~/tools";

const DEFAULT_EVENT_VERSION = "0.2";

export function createRAEMTestHarness (options: Object, ...commandBlocks: any) {
  try {
    const TestHarness = options.TestHarness || RAEMTestHarness;
    const ret = new TestHarness({
      name: "RAEM Test Harness", ContentAPI: RAEMTestAPI,
      ...options,
    });
    commandBlocks.forEach(events => ret.chronicleEvents(events));
    return ret;
  } catch (error) {
    throw wrapError(error, new Error("During createProphetTestHarness"),
        "\n\toptions:", ...dumpObject(options),
        "\n\teventBlocks:", ...dumpObject(commandBlocks));
  }
}

export default class RAEMTestHarness extends LogEventGenerator {
  constructor ({ ContentAPI, name, verbosity, reducerOptions = {}, corpusOptions = {} }) {
    super({ name, verbosity });
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
   * chronicleEvents always delegates the operation to corpus.dispatch
   * (handling restricted commands is done via .chronicleEvents, only
   * available in @valos/prophet). Also validates is-restricted for
   * incoming commands, and for is-universal for resulting stories.
   *
   * @param {any} rest
   *
   * @memberof RAEMTestHarness
   */
  chronicleEvents (events: EventBase[]) {
    try {
      return {
        eventResults: events.map(event => {
          const story = this.corpus.dispatch(event);
          return {
            event, story, getTruthEvent: () => event,
          };
        }),
      };
    } catch (error) {
      throw this.wrapErrorEvent(error, "dispatch",
          "\n\tevents:", ...dumpObject(events));
    }
  }
  chronicleEvent (event: EventBase, options: ?Object) {
    return this.chronicleEvents([event], options).eventResults[0];
  }

  createCorpus () {
    return createCorpus(this.ContentAPI, {
      eventLogger: this,
      ...this.reducerOptions,
    }, {
      name: `${this.getName()} Corpus`,
      verbosity: this.getVerbosity(),
      logger: this.getLogger(),
      // stubify all unpacked Transient's when packing: this causes them to autorefresh
      ...this.corpusOptions,
    });
  }

  createValker () {
    return new Valker(
        this.schema,
        this.getVerbosity(),
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

export function createCorpus (ContentAPI: Object, reducerOptions?: Object, corpusOptions?: Object) {
  const { schema, validators, mainReduce, subReduce } = createRootReducer(Object.freeze({
    ...ContentAPI,
    ...reducerOptions,
  }));
  return new Corpus(Object.freeze({
    name: "Test Corpus",
    middlewares: _createTestMiddlewares({ schema, validators }),
    initialState: OrderedMap(),
    reduce: mainReduce,
    subReduce,
    schema,
    ...corpusOptions,
  }));
}

function _createTestMiddlewares ({ schema, validators }) {
  return [
    createProcessCommandVersionMiddleware(DEFAULT_EVENT_VERSION),
    // createProcessCommandIdMiddleware(undefined, schema),
    createValidateEventMiddleware(validators),
    createBardMiddleware(),
  ];
}
