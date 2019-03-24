// @flow

/* eslint-disable */

import ContentAPI from "./ProphetContentAPI";
import schemeModules from "./schemeModules";

const valos = require("~/gateway-api/valos").default;

export default valos.exportPlugin({ name: "@valos/prophet", ContentAPI, schemeModules });

export {                   default as EVENT_VERSION } from "./tools/EVENT_VERSION";

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
                                      deserializeVRL,
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
export type {
                                      AuthorityConfig,
                                      AuthorityProphetOptions,
                                      SchemeModule,
} from "./AuthorityNexus";
