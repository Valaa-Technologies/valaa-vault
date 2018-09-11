// @flow

import type Command from "~/raem/command";
import type ValaaURI from "~/raem/ValaaURI";
import { VRef } from "~/raem/ValaaReference";

import Follower from "~/prophet/api/Follower";
import type Prophecy from "~/prophet/api/Prophecy";
import type PartitionConnection from "~/prophet/api/PartitionConnection";

import { LogEventGenerator } from "~/tools/Logger";

export type ClaimResult = {
  prophecy: Prophecy;
  getFinalEvent: () => Promise<Command>;
}

export type EventData = {
  type: "CREATED" | "MODIFIED" | "FIELDS_SET" | "ADDED_TO" | "REMOVED_FROM" | "REPLACED_WITHIN"
      | "SPLICED" | "TRANSACTED" | "FROZEN"
}

export type EventCallback = ((event: EventData) => void);

export type MediaInfo = {
  mediaId: VRef,
  bvobId?: string,
  name?: string,
  sourceURL?: string,
  mime?: string,
  type?: string,
  subtype?: string,
  asURL? : any,                // default false. Available options: true, false, "data", "public",
                               // "source".
  contentDisposition?: string,
  contentEncoding?: string,
  contentLanguage?: string,
  contentType?: string,
};

export type RetrieveMediaContent = (mediaId: VRef, mediaInfo: MediaInfo) => Promise<any>;

export type NarrateOptions = {
  narrateRemote?: boolean,   // default true - narrate remote content.
  subscribeRemote?: boolean, // default true - subscribe for downstream events.

  fullNarrate?: boolean,     // default false - await for remote narration result even if optimistic
                             // could be performed locally.
  snapshots?: boolean,       // default true, currently ignored - start narration from most recent
                             // snapshot within provided event range
  commands?: boolean,        // default true - narrate pending commands as well.
  callback?: EventCallback,
  firstEventId?: number,
  lastEventId?: number,
};

export type ChronicleOptions = NarrateOptions & {
  retrieveMediaContent?: RetrieveMediaContent,
};

/* eslint-disable no-unused-vars */

/**
 * Interface for sending commands to upstream.
 */
export default class Prophet extends LogEventGenerator {
  _upstream: Prophet;
  _followers: Follower;

  constructor ({ upstream, ...rest }: Object) {
    super({ ...rest });
    this._upstream = upstream;
    this._followers = new Map();
  }

  addFollower (follower: Follower): Follower {
    const discourse = this._createDiscourse(follower);
    this._followers.set(follower, discourse);
    return discourse;
  }

  _createDiscourse (follower: Follower) {
    return follower;
  }

  /**
   * claim - Sends a command upstream or rejects it immediately.
   *
   * @param  {type} command                             description
   * @returns {ClaimResult}                             description
   */
  claim (command: Command, options: { timed?: Object } = {}): ClaimResult {
    return this._upstream.claim(command, options);
  }

  _confirmTruthToAllFollowers (truthEvent: Object, purgedCommands?: Array<Object>) {
    (this._followers || []).forEach(discourse => {
      try {
        discourse.receiveTruth(truthEvent, purgedCommands);
      } catch (error) {
        this.outputErrorEvent(this.wrapErrorEvent(error,
            "_confirmTruthToAllFollowers",
            "\n\ttruthEvent:", truthEvent,
            "\n\tpurgedCommands:", purgedCommands,
            "\n\ttarget discourse:", discourse,
        ));
      }
    });
  }

  _repeatClaimToAllFollowers (command: Object) {
    (this._followers || []).forEach(discourse => {
      try {
        discourse.repeatClaim(command);
      } catch (error) {
        this.outputErrorEvent(this.wrapErrorEvent(error,
            "_repeatClaimToAllFollowers",
            "\n\trepeated command:", command,
            "\n\ttarget discourse:", discourse,
        ));
      }
    });
    return command;
  }

  /**
   * Returns a connection to partition identified by given partitionURI.
   *
   * The returned connection might be shared between other users and implements internal reference
   * counting; it is acquired once as part of this call. The connection must be manually released
   * with releaseConnection or otherwise the connection resources will be left open.
   *
   * The connection is considered acquired and the promise is resolved after a lazy greedy
   * "first narration" is complete. Lazy means that only the single closest source which
   * can provide events is consulted. Greedy means that all events from that source are retrieved.
   *
   * The design principle behind this is that no non-authoritative event log cache shalle have
   * functionally incomplete event logs, even if event log might be outdated in itself.
   *
   * More specifically in inspire context the first source resulting in non-zero events is chosen:
   * 1. all events and commands of the optional explicit initialNarrateOptions.eventLog option and
   *    the latest previously seen full narration of this partition in the Scribe (deduplicated)
   * 2. all events in the most recent authorized snapshot known by the remote authority connection
   * 3. all events in the remote authorize event log itself
   *
   * Irrespective of where the first narration is sourced, an authorized full narration is
   * initiated against the remote authority if available.
   *
   * @param {ValaaURI} partitionURI
   * @returns {PartitionConnection}
   *
   * @memberof Prophet
   */
  acquirePartitionConnection (partitionURI: ValaaURI,
      options: NarrateOptions = {}): PartitionConnection {
    return this._upstream.acquirePartitionConnection(partitionURI, options);
  }

  /**
   * Returns the bvob buffer for given bvobId as an ArrayBuffer if it is locally available,
   * undefined otherwise.
   *
   * @param {string} bvobId
   * @returns
   *
   * @memberof Prophet
   */
  tryGetCachedBvobContent (bvobId: string): ArrayBuffer {
    return this._upstream.tryGetCachedBvobContent(bvobId);
  }

  /**
   * Returns a map of fully acquired partition connections by the connection id.
   */
  getFullPartitionConnections () : Map<string, PartitionConnection> {
    return this._upstream.getFullPartitionConnections();
  }

  /**
   * Returns a map of pending partition connections by the connection id.
   */
  getPendingPartitionConnections () : Map<string, Promise<PartitionConnection> > {
    return this._upstream.getPendingPartitionConnections();
  }
}
