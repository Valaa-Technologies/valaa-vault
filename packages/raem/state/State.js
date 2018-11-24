import { OrderedMap } from "immutable";

// default type exports are not supported by flowtype yet
export type State = OrderedMap<string, OrderedMap<string, any> >; // eslint-disable-line

