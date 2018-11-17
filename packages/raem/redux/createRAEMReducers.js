import { Map } from "immutable";

import { CREATED, DESTROYED, FIELDS_SET, ADDED_TO, REMOVED_FROM, REPLACED_WITHIN,
    DUPLICATED, FROZEN, RECOMBINED, TIMED, TRANSACTED } from "~/raem/command";
import create from "~/raem/redux/reducers/create";
import duplicate from "~/raem/redux/reducers/duplicate";
import destroy from "~/raem/redux/reducers/destroy";
import modify from "~/raem/redux/reducers/modify";
import freeze from "~/raem/redux/reducers/freeze";
import recombine from "~/raem/redux/reducers/recombine";
import transact from "~/raem/redux/reducers/transact";
import { createBardReducer } from "~/raem/redux/Bard";

const EMPTY_MAP = Map();

export default function createRAEMReducers () {
  return {
    [CREATED]: createBardReducer(create),
    [DESTROYED]: createBardReducer(destroy, { skipPostPassageStateUpdate: true }),
    [DUPLICATED]: createBardReducer(duplicate),
    [FIELDS_SET]: createBardReducer(modify),
    [ADDED_TO]: createBardReducer(modify),
    [REMOVED_FROM]: createBardReducer(modify),
    [REPLACED_WITHIN]: createBardReducer(modify),
    [FROZEN]: createBardReducer(freeze),
    [RECOMBINED]: createBardReducer(recombine, { skipPostPassageStateUpdate: true }),
    [TRANSACTED]: createBardReducer(transact),
    // TIMED events will be expanded to actions and resulting events/sub-actions by appropriate
    // FalseProphet engines and cogs
    [TIMED]: (state = EMPTY_MAP) => state,
    // TODO(iridian): This might not be a correct place for this. What is, though?
    ["@@redux/INIT"]: state => state,//eslint-disable-line
  };
}
