// @flow

import type ValaaURI from "~/raem/ValaaURI";

import Prophet from "~/prophet/api/Prophet";

import AuthorityPartitionConnection from "./AuthorityPartitionConnection";

/**
 * AuthorityProphet is the base Prophet implementation for various
 * types of authorities.
 *
 * @export
 * @class Oracle
 * @extends {Prophet}
 */
export default class AuthorityProphet extends Prophet {

  static PartitionConnectionType = AuthorityPartitionConnection;

  constructor ({
    authorityURI, authorityConfig, nexus, ...rest
  }: Object) {
    super({ ...rest });
    this._nexus = nexus;
    this._authorityURI = authorityURI;
    this._authorityConfig = authorityConfig;
  }

  getAuthorityURI (): ValaaURI { return this._authorityURI; }

  isLocallyPersisted () { return this._authorityConfig.isLocallyPersisted; }
  isRemoteAuthority () { return this._authorityConfig.isRemoteAuthority; }
  /*
    Authority qualities to think about (with overlapping semantics):
  isPrimary ()      - authorizes and serves event logs which can
                      contain arbitrary resource mutations
  isShadow ()       - serves virtual event logs which represent
                      extraneous resources
  isRecordable ()   - exposes a direct API for extending (non-frozen)
                      event logs with new events
  isGenerated ()    - event log is programmatically generated from
                      partition URI itself
  isProcedural ()   - contains locally generated resource model
                      extensions which only use an event log as a seed
  isHashChained ()  - enforces event log consistency
  isReducing ()     - is able to perform local reductions, eventId
                      recalculations w/ pre-condition checking, etc.
  isForgetful ()    - forgets history and always serves only a
                      snapshot of the most recent content

  Use cases which employ above qualities in different ways:
  Bvob/Tag/Data authorities / partitions
  Database proxy authorities / partitions (db data represented as partition event logs)
  IoT device authorities / partitions (event logs representing state history & actuator changes)
  Query authorities (queries as partition URI's which return immutable event logs,
      representing query result sets, live queries, etc.)
  Identity authorities / partitions (access control relation target user partitions)
  */
}
