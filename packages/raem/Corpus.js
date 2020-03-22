// @flow

import { invariantifyObject, invariantifyFunction } from "~/tools/invariantify";

import type { Action } from "~/raem/events";
import Bard, { StoryIndexTag } from "~/raem/redux/Bard";
import layoutByObjectField from "~/raem/tools/denormalized/layoutByObjectField";

import { dumpify } from "~/tools";
import { dumpObject } from "~/tools/wrapError";

// TODO(iridian, 2020-03): Corpus and Bard could be merged.

/**
 * Bards in general and Corpus in specific are responsibile for
 * managing incoming actions and modifying state in response to them.
 *
 * Corpus acts as the grandmaster Bard (ie. the object prototype) for
 * individual journeyman Bard's which are created to handle specific
 * commands.
 *
 * Valker, Discourses and Transactions are responsible for computation
 * and creation of actions.
 *
 * @export
 * @class Corpus
 * @extends {Bard}
 */
export default class Corpus extends Bard {
  constructor (options: {
    name: ?string, verbosity: ?number, parent: Object,
    schema: Object, middlewares: Array, reduce: Function, subReduce: Function,
    initialState: Object,
  }) {
    super(options);
    invariantifyObject(options.schema, "schema");
    invariantifyFunction(options.reduce, "reduce");
    invariantifyFunction(options.subReduce, "subReduce");
    invariantifyObject(options.initialState, "initialState", { allowUndefined: true });
    this.subReduce = options.subReduce || options.reduce;
    this.reduce = options.reduce;
    this._dispatch = options.middlewares.reduceRight(
        (next, middleware) => middleware(this)(next),
        (action, corpus) => {
          const newState = corpus.reduce(corpus.getState(), action);
          corpus.updateState(newState);
          return action;
        });
    options.initialState[StoryIndexTag] = -1;
    this.reinitialize(options.initialState);
  }

  reinitialize (newInitialState) {
    this.setState(newInitialState);
  }

  dispatch (event: Action, description: string) {
    const prevName = this.getName();
    try {
      const id = event.id || ((event.aspects || {}).command || {}).id;
      this.setName(`${description || event.type}:${id || "<command.id missing>"}`);
      this.logEvent(1, () => ["dispatching event:", ...dumpObject(event)]);
      return this._dispatch(event, this);
    } catch (error) {
      throw this.wrapErrorEvent(error, 1, `dispatch()`,
          "\n\tevent:", dumpify(event),
          "\n\tthis:", ...dumpObject(this),
      );
    } finally {
      this.setName(prevName);
    }
  }

  dumpListing () {
    this.warn("Resources denormalized", this.getState().toJS());
    this.warn("Resources by name", layoutByObjectField(this.getState(), "name", ""));
  }
}
