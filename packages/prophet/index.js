// @flow

/* eslint-disable */

import exportValaaPlugin from "~/tools/exportValaaPlugin";

import ContentAPI from "./ProphetContentAPI";
import schemeModules from "./schemeModules";

export default exportValaaPlugin({ name: "@valos/prophet", ContentAPI, schemeModules });

export {
                                      ContentAPI,
                        ContentAPI as EngineContentAPI,
};
export {                   default as Discourse } from "./api/Discourse";
export {                   default as Follower } from "./api/Follower";
export {                   default as PartitionConnection } from "./api/PartitionConnection";
export {                   default as Prophet } from "./api/Prophet";
export                           type Transaction = Object;

export {
                           default as FalseProphet,
                                      deserializeVRef,
} from "./FalseProphet";
export {
                           default as FalseProphetDiscourse
} from "./FalseProphet/FalseProphetDiscourse";

export {                   default as Oracle } from "./Oracle";
export {                   default as DecoderArray } from "./Oracle/DecoderArray";

export {                   default as Scribe } from "./Scribe";

export {                   default as AuthorityProphet } from "./AuthorityProphet";
export {
                           default as AuthorityPartitionConnection,
                                      AuthorityEventResult,
} from "./AuthorityProphet/AuthorityPartitionConnection";
export {                   default as AuthorityNexus } from "./AuthorityProphet/AuthorityNexus";
