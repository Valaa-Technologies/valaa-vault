// @flow

/* eslint-disable */

import Valaa from "~/tools/Valaa";

import ContentAPI from "./ProphetContentAPI";
import schemeModules from "./schemeModules";

export default Valaa.exportPlugin({ name: "@valos/prophet", ContentAPI, schemeModules });

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
