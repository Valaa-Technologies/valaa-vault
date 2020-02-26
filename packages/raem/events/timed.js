// @flow

import Action, { ActionCollection, validateActionCollectionBase } from "~/raem/events/Action";

import { invariantifyNumber, invariantifyObject } from "~/tools/invariantify";

export const TIMED = "TIMED";

export class Timed extends ActionCollection {
  type: "TIMED";

  time: number;
  startTime: ?number;
  interpolation: ?Object;
  extrapolation: ?Object;
}

/**
 * A delayed, command-ownership-transferring action.
 * TIMED will be expanded by appropriate chronicle service time-engine(s) at specified time into
 * concrete sub-actions.
 * These sub-actions are non-authoritative suggestions for the time-engine(s) to invoke.
 * The time-engine(s) is completely free to fully modify or ignore the sub-actions before
 * invokation, including their invokation time, action and resource ids and any sub-sub-actions.
 *
 * The 'time' argument is a context dependent timestamp suggestion, its meaning interpreted by the
 * authoritative time-engine(s).
 *
 * TIMED action is always associated with a primary chronicle, just like TRANSACTED is.
 * The authority of this chronicle, which usually is a time-engine, then accepts, rejects or
 * rewrites the action as usual.
 * The only guarantee for an accepted or rewritten TIMED action is that its sub-actions have been
 * form-, and schema-validated. Their sub-actions are still considered only suggestions and can be
 * fully rewritten or ignored.
 * This said, a well-behaving authoritative time-engine can also perform best-effort predictive
 * content validation and reports known rewrites already before accept/reject/rewrite -response,
 * and makes best effort to stick to these promises, even it can't guarantee them.
 *
 * Like other actions, TIMED action itself is considered resolved upon the accept/reject/rewrite
 * response but definitively before sub-action evaluation starts, even if the time specifies Now,
 * ie. the current instant.
 *
 * TODO(iridian): Create a suggested systematic but optional mechanism for time-engine(s) to report
 * rewrites that happen later: perhaps always execute TIMED contents in a TRANSACTED and make it
 * have sourceTimed pointing to the id of the source TIME action, with its contents being the
 * rewritten ones? There is no generic way to maintain sub-action correspondence to resolved
 * final sub-event correspondence because time-engine(s) can fully rewrite them. Nevertheless an
 * opt-in principle could be that the resolved TRANSACTED event contains same number of sub-actions
 * with rejected sub-actions being null actions.
 *
 * @export
 * @param {any} { time, startTime = time, interpolation, extrapolation }
 * @returns
 */
export default function timed (action: Action): Timed {
  action.type = TIMED;
  return validateTimed(action);
}

export function validateTimed (action: Action, validateAction: ?Function): Timed {
  const {
    actions, time, startTime, interpolation, extrapolation, ...rest
  } = action;

  validateActionCollectionBase(TIMED, action, actions, rest, validateAction);

  invariantifyNumber(time, "TIMED.startTime",
      { allowUndefined: true }, "\n\taction:", action);
  invariantifyNumber(startTime, "TIMED.startTime",
      { allowUndefined: true }, "\n\taction:", action);
  invariantifyObject(interpolation, "TIMED.interpolation",
      { allowUndefined: true }, "\n\taction:", action);
  invariantifyObject(extrapolation, "TIMED.extrapolation",
      { allowUndefined: true }, "\n\taction:", action);

  return action;
}
