import { OrderedMap } from "immutable";

import type { EventBase } from "~/raem/events";
import createRootReducer from "~/raem/tools/createRootReducer";
import createValidateEventMiddleware from "~/raem/redux/middleware/validateEvent";
import { createBardMiddleware } from "~/raem/redux/Bard";

import RAEMTestAPI from "~/raem/test/RAEMTestAPI";

import Corpus from "~/raem/Corpus";
import Valker from "~/raem/VALK/Valker";

import trivialClone from "~/tools/trivialClone";
import {
  dumpObject, LogEventGenerator, mapEagerly, outputError, thenChainEagerly, wrapError,
} from "~/tools";

const TEST_EVENT_VERSION = "0.2";

export function createRAEMTestHarness (options: Object, ...commandBlocks: any) {
  let harness;
  const TestHarnessType = options.TestHarness || RAEMTestHarness;
  const wrap = new Error(`During createRAEMTestHarness/${TestHarnessType.name}`);
  return thenChainEagerly(TestHarnessType, [
        // #0
        (TestHarnessType_) => (harness = new TestHarnessType_({
          name: "RAEM Test Harness", ContentAPI: RAEMTestAPI,
          ...options,
        })),
        // #1
        () => harness.initialize(),
        // Each commandBlock maps to two steps: [#2, #3], [#4, #5], etc.
        // Event steps set the thenChain head to corresponding commandBlocks events,
        // odd steps does a chronicleEvents for those. This is for nicer error context messages.
        ...[].concat(...commandBlocks.map(events => [
          () => events,
          (eventsAsHead) => mapEagerly(
              harness.chronicleEvents(eventsAsHead).eventResults,
              result => (
                  result.getPersistedStory
                      ? result.getPersistedStory()
                  : result.getLocalStory
                      ? result.getLocalStory()
                      : result.getTruthEvent())),
        ])),
        () => harness,
      ],
      function errorOnCreateRAEMTestHarness (error, index, head) {
        throw wrapError(error, wrap,
            `\n\tchain step #${index} head:`, ...dumpObject(head),
            "\n\t(step #0 = new, #1 = initialize, #3 = commandBlock[0], #5 = commandBlock[1], ...)",
            "\n\toptions:", ...dumpObject(options),
            "\n\teventBlocks:", ...dumpObject(commandBlocks),
            "\n\tharness:", ...dumpObject(harness),
        );
      });
}

export default class RAEMTestHarness extends LogEventGenerator {
  constructor ({ ContentAPI, name, verbosity, reducerOptions = {}, corpusOptions = {}, ...rest }) {
    super({ name, verbosity });
    this.ContentAPI = ContentAPI;
    this.schema = ContentAPI.schema;
    this.reducerOptions = reducerOptions;
    this.corpusOptions = corpusOptions;
    Object.assign(this, rest);
  }

  initialize () {
    return thenChainEagerly(null, [
      () => this.createCorpus(),
      corpus => (this.corpus = corpus),
      () => this.createValker(),
      valker => (this.valker = valker),
    ]);
  }

  getState () { return this.corpus.getState(); }
  getValker () {
    this.valker.setState(this.corpus.getState());
    return this.valker;
  }

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
    return this.valker.run(...rest);
  }

  /**
   * chronicleEvents always delegates the operation to corpus.dispatch
   * (handling restricted commands is done via .chronicleEvents, only
   * available in @valos/prophet). Also validates is-restricted for
   * incoming commands, and is-universal for resulting stories.
   *
   * @param {any} rest
   *
   * @memberof RAEMTestHarness
   */
  chronicleEvents (events: EventBase[]) {
    try {
      return {
        eventResults: events.map(event_ => {
          const event = trivialClone(event_);
          if (!event.meta) event.meta = {};
          if (event.meta.isBeingUniversalized === undefined) {
            event.meta.isBeingUniversalized = true;
          }
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

  createCorpus (corpusOptions: Object = {}) {
    return createCorpus(this.ContentAPI, {
      eventLogger: this,
      ...this.reducerOptions,
    }, {
      name: `${this.getName()} Corpus`,
      verbosity: this.getVerbosity(),
      logger: this.getLogger(),
      // stubify all unpacked Transient's when packing: this causes them to autorefresh
      ...this.corpusOptions,
      ...corpusOptions,
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
        this.corpusOptions.steppers,
    );
  }

  static interceptErrors (testFunction) {
    return () => thenChainEagerly(null,
        () => testFunction(),
        RAEMTestHarness.errorOn(new Error(testFunction.name)));
  }
  interceptErrors = RAEMTestHarness.interceptErrors;

  static errorOn (wrap, ...rest) {
    return (error, maybeStepIndex, maybeHead) => {
      const wrappedError = wrapError(error, wrap,
          ...(maybeStepIndex === undefined ? []
              : (typeof maybeStepIndex === "number") ? [
                `\n\tstep #${maybeStepIndex} head:`, ...dumpObject(maybeHead),
              ] : [
                "\n\tsecond error arg:", ...dumpObject(maybeStepIndex),
                "\n\tthird error arg:", ...dumpObject(maybeHead),
              ]),
          ...rest);
      outputError(wrappedError, "Harness: showing error contexts of the top-level test exception");
      throw wrappedError;
    };
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

function _createTestMiddlewares ({ validators }) {
  return [
    // createProcessCommandIdMiddleware(undefined, schema),
    createValidateEventMiddleware(validators, TEST_EVENT_VERSION, TEST_EVENT_VERSION),
    createBardMiddleware(),
  ];
}
