import { Map } from "immutable";

import { getActionFromPassage } from "~/raem/redux/Bard";

import { dumpify, dumpObject, invariantifyArray, LogEventGenerator } from "~/tools";
import { arrayFromAny } from "~/tools/sequenceFromAny";

/**
 * Combines a list of reducer-by-action-type objects into a single reducer-by-action-type.
 * Individual reducers for each action type are then chained together.
 */
function mergeActionReducers (reducerDictionaryCreates, context) {
  invariantifyArray(reducerDictionaryCreates, "mergeActionReducers.reducerDictionaryCreates");
  const ret = {};
  for (const createReducerDictionary of reducerDictionaryCreates) {
    for (const [actionType, reducer] of Object.entries(createReducerDictionary(context))) {
      ret[actionType] = arrayFromAny(ret[actionType]).concat([reducer]);
    }
  }
  for (const [type, reducers] of Object.entries(ret)) {
    ret[type] = createSingularReducer(reducers);
  }
  return Object.freeze(ret);

  function createSingularReducer (reducers) {
    // Two different reduce sides against the same action coin.
    // This one is the reducer for reducing sequences of actions with a single function.
    return function reduce (state, action, ...rest) {
      // This one reduces a sequence of reducer functions against a single action.
      return reducers.reduce(
          (innerState, reducer) => reducer.call(this, innerState, action, ...rest),
          state,
      );
    };
  }
}

/**
 * Creates the root server reducer.
 *
 * Golden rules of reduction: Reducers always succeed.
 *
 * This principle is there to ensure the lookup state is always
 * consistent or blocked. Eventually a reducer will fail in production.
 * This is treated as an internal error, it shall halt the event
 * sourcing so that queries will still work, escalate the issue and
 * initiate recovery mechanisms. Servers should in principle hold
 * minimalistic state to localize the consequences of a corrupted
 * action.
 *
 * The guidelines to help with this rule:
 * 1. Reducers never wait on external resources. External resources can
 *    fail.
 * 2. Reducers are never async. Event time is linear so there's no
 *    benefit, but risks.
 * 3. Only exceptions allowed are internal errors which will be
 *    escalated.
 */
export default function createRootReducer ({
  schema, eventLogger, reducers, validators, context = {},
  subReduceLogThreshold = 2, reduceLogThreshold = 1
}) {
  const reducerContext = {
    subReduce,
    ...context,
    schema,
    eventLogger,
    mainReduce,
    reducers,
    validators,
  };
  const reducerByActionType = mergeActionReducers(reducers, reducerContext);
  if (!reducerContext.eventLogger) {
    reducerContext.eventLogger = new LogEventGenerator({ name: "Unnamed reducer" });
  }

  function mainReduce (state = Map(), story) {
    const mainLogger = this || reducerContext.eventLogger;
    try {
      if (mainLogger.getVerbosity() >= reduceLogThreshold) {
        logActionInfo(mainLogger, `Reducing${story.timeStamp ? ` @${story.timeStamp}` : ""}`,
            story, mainLogger.getVerbosity() === reduceLogThreshold);
      }
      const reducer = reducerByActionType[story.type];
      if (reducer) return reducer.call(this, state, story);
      mainLogger.warnEvent(
          `WARNING: While reducing, no reducer for action type ${story.type}, ignoring`);
      return state;
    } catch (error) {
      throw mainLogger.wrapErrorEvent(error, `mainReduce(${story.type}, ${story.id || ""})`,
          "\n\tstory:", ...dumpObject(story),
          "\n\tevent:", ...dumpObject(getActionFromPassage(story)),
          "\n\tthis:", this);
    }
  }
  /**
   * Reduces given action as a sub-action with the appropriate reducer.
   * Note: passes 'this' as a third argument for the reducer.
   * @param {any} action       command, event, story or passage.
   * @param {any} parentPassage
   * @returns
   */
  function subReduce (state, passage) {
    const subEventLogger = this || reducerContext.eventLogger;
    try {
      if (subEventLogger.getVerbosity() >= subReduceLogThreshold) {
        logActionInfo(subEventLogger, "Sub-reducing",
            passage, subEventLogger.getVerbosity() === subReduceLogThreshold);
      }
      if (passage.story && passage.story.meta.isBeingUniversalized) {
        // Offers limited protection against programming errors for
        // virtual passages especially.
        const validator = validators[passage.type];
        if (!validator) {
          throw new Error(`No validator found for sub-action of type ${passage.type}`);
        }
        validator(passage);
      }
      const reducer = reducerByActionType[passage.type];
      if (reducer) return reducer.call(this, state, passage);
      throw new Error(`No reducer found for sub-action of type ${passage.type}`);
    } catch (error) {
      throw subEventLogger.wrapErrorEvent(error, `subReduce(${passage.typeName})`,
          "\n\tpassage:", ...dumpObject(passage),
          "\n\taction:", ...dumpObject(getActionFromPassage(passage)),
          "\n\tthis:", this);
    }
  }

  function logActionInfo (logger, header, passage, shouldSlice) {
    let idString = "";
    const isSubReduce = (header === "Sub-reducing");
    if (passage.id) {
      idString = `<${passage.id}>`;
      if (passage.typeName) idString = `${idString}:${passage.typeName}`;
    }
    // eslint-disable-next-line
    const { type, timeStamp, typeName, id, passages, parentPassage, bard, ...rest } = passage;
    const action = getActionFromPassage(passage);
    logger.logEvent(
        `\n\t${header} ${passage.type} ${idString}`,
        (isSubReduce ? "\n\tpassage/rest:" : "\n\tstory/rest:"),
        dumpify(rest, { sliceAt: shouldSlice && 380 }),
        (isSubReduce ? "\n\taction:" : "\n\tevent:"),
        dumpify(action && { ...action }, { sliceAt: shouldSlice && 380 }));
  }
  return reducerContext;
}
