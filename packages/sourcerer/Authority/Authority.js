// @flow

import type { ValaaURI } from "~/raem/ValaaURI";

import Sourcerer from "~/sourcerer/api/Sourcerer";

import AuthorityConnection from "./AuthorityConnection";

/**
 * Authority is the base Sourcerer implementation for various
 * types of authorities.
 *
 * @export
 * @class Oracle
 * @extends {Sourcerer}
 */
export default class Authority extends Sourcerer {
  static ConnectionType = AuthorityConnection;

  constructor ({ authorityURI, authorityConfig, nexus, ...rest }: Object) {
    super({ ...rest });
    this._nexus = nexus;
    this._authorityURI = authorityURI;
    this._authorityConfig = authorityConfig;
  }

  getAuthorityURI (): ValaaURI { return this._authorityURI; }

  isLocallyPersisted () { return this._authorityConfig.isLocallyPersisted; }
  isPrimaryAuthority () { return this._authorityConfig.isPrimaryAuthority; }
  isRemoteAuthority () { return this._authorityConfig.isRemoteAuthority; }
  getEventVersion () { return this._authorityConfig.eventVersion; }

  /*
    Authority qualities to think about (with overlapping semantics):
  isPrimary ()      - authorizes and serves event logs which can
                      contain arbitrary resource mutations
  isShadow ()       - serves virtual event logs which represent
                      extraneous resources
  isRecordable ()   - exposes a direct API for extending (non-frozen)
                      event logs with new events
  isGenerated ()    - event log is programmatically generated from
                      chronicle URI itself
  isProcedural ()   - contains locally generated resource model
                      extensions which only use an event log as a seed
  isHashChained ()  - enforces event log consistency
  isReducing ()     - is able to perform local reductions, log.index
                      reorderings w/ pre-condition checking, etc.
  isForgetful ()    - forgets history and always serves only a
                      snapshot of the most recent content

  Use cases which employ above qualities in different ways:
  Bvob/Tag/Data authorities / chronicles
  Database proxy authorities / chronicles (db data represented as chronicle event logs)
  IoT device authorities / chronicles (event logs representing state history & actuator changes)
  Query authorities (queries as chronicle URI's which return immutable event logs,
      representing query result sets, live queries, etc.)
  Identity authorities / chronicles (access control relation target user chronicles)
  */
}
