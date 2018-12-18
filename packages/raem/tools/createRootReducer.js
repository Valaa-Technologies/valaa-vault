import { Map } from "immutable";

import { dumpify, invariantifyArray, LogEventGenerator } from "~/tools";
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
 * This principle is there to ensure the lookup state is always consistent or blocked.
 * Eventually a reducer will fail in production. This is treated as an internal error, it shall halt
 * the event sourcing so that queries will still work, escalate the issue and initiate recovery
 * mechanisms. Servers should in principle hold minimalistic state to localize the consequences of
 * a corrupted action.
 *
 * The guidelines to help with this rule:
 * 1. Reducers never wait on external resources. External resources can fail.
 * 2. Similarily reducers are never async. Event time is linear so there's no benefit, but risks.
 * 3. Only exceptions allowed are internal errors which will be escalated.
 * 4. Hook function calls must always be done by delayCall(() => doHookCallbackstuff) which will
 *    perform the callback once the reducer has finished executing.
 *
 * To facilitate middleware which does preliminary reduction based validation of actions:
 * 5. All side-effects must be wrapped inside delayCall, so that if a reduction of a new action
 *    fails the delayed calls (and the candidate reduction state head) can be safely discarded.
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
    delayCall,
    mainReduce,
    reducers,
    validators,
  };
  const reducerByActionType = mergeActionReducers(reducers, reducerContext);
  if (!reducerContext.eventLogger) {
    reducerContext.eventLogger = new LogEventGenerator({ name: "Unnamed reducer" });
  }

  function delayCall (callback) {
    // The Promise specification guarantees that then() handlers will be executed only after the
    // execution stack only has platform functions. So we're golden.
    Promise.resolve().then(callback).catch(error => {
      (this || reducerContext.eventLogger)
          .error(`ERROR: While executing delayed call: ${error.message}, for callback ${callback
              }, in ${error.stack}`);
    });
  }

  function mainReduce (state = Map(), action) {
    const mainLogger = this || reducerContext.eventLogger;
    try {
      if (mainLogger.getVerbosity() >= reduceLogThreshold) {
        const time = action.timeStamp;
        const minor = action.typeName ? `${action.typeName} ` : "";
        // eslint-disable-next-line
        const { timeStamp, type, typeName, id, passages, parentPassage, bard, ...rest } = action;
        mainLogger.logEvent(
            `Reducing @${time} ${action.type} ${minor}${
                dumpify(action.id || "", { sliceAt: 40, sliceSuffix: "..." })}`,
            `\n\t${dumpify(rest, { sliceAt: 380 })}`);
      }
      const reducer = reducerByActionType[action.type];
      if (reducer) return reducer.call(this, state, action);
      mainLogger.warnEvent(
          `WARNING: While reducing, no reducer for action type ${action.type}, ignoring`);
      return state;
    } catch (error) {
      throw mainLogger.wrapErrorEvent(error, `mainReduce(${action.type}, ${action.id || ""})`,
          "\n\taction:", action,
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
  function subReduce (state, action) {
    const subEventLogger = this || reducerContext.eventLogger;
    try {
      if (subEventLogger.getVerbosity() >= subReduceLogThreshold) {
        let minor = action.typeName ? `${action.typeName} ` : "";
        if (action.id) minor = `${minor}${dumpify(action.id, { sliceAt: 40, sliceSuffix: "..." })}`;
        // eslint-disable-next-line
        const { type, typeName, id, passages, parentPassage, bard, ...rest } = action;
        subEventLogger.logEvent(
            `Sub-reducing ${action.type} ${minor}`,
            `\n\tpassage:${dumpify(rest, { sliceAt: 380 })}`,
            "\n\taction:", dumpify(Object.getPrototypeOf(action)));
      }
      // TODO(iridian): This is likely incorrect (but harmless): probably should be just
      //   if (action.isBeingUniversalized)
      if (action.story && action.story.isBeingUniversalized) {
        // Offers limited protection against programming errors for generated passages especially.
        const validator = validators[action.type];
        if (!validator) throw new Error(`No validator found for sub-action of type ${action.type}`);
        validator(action);
      }
      const reducer = reducerByActionType[action.type];
      if (reducer) return reducer.call(this, state, action);
      throw new Error(`No reducer found for sub-action of type ${action.type}`);
    } catch (error) {
      throw subEventLogger.wrapErrorEvent(error, `subReduce(${action.typeName})`,
          "\n\taction:", action,
          "\n\tthis:", this);
    }
  }
  return reducerContext;
}
