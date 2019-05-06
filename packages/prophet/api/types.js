// @flow

import { Command, EventBase, Truth } from "~/raem/events";
import type { VRL } from "~/raem/VRL";
import { getActionFromPassage, Story } from "~/raem/redux/Bard";

import thenChainEagerly from "~/tools/thenChainEagerly";

export type MediaInfo = {
  mediaVRL: VRL,
  bvobId?: string,
  name?: string,
  sourceURL?: string,
  mime?: string,
  type?: string,
  subtype?: string,
  asURL?: any,                // default false. Available options: true, false, "data", "public",
                               // "source".
  contentDisposition?: string,
  contentEncoding?: string,
  contentLanguage?: string,
  contentType?: string,
};

export type RetrieveMediaBuffer = (mediaInfo: MediaInfo) => Promise<any>;

export type EventData = {
  type: "CREATED" | "FIELDS_SET" | "ADDED_TO" | "REMOVED_FROM" | "REPLACED_WITHIN"
      | "TRANSACTED" | "FROZEN"
}
export type ReceiveEvents = ((events: EventData[], options: Object) =>
    (Promise<EventBase> | EventBase)[]);

export type NarrateOptions = {
  remote?: boolean,                // If false never narrate to upstream, if true wait for upstream
                                   // narration result even if an optimistic narration can be
                                   // performed locally
  snapshots?: boolean,             // default: true, currently ignored. Start narration from most
                                   // recent snapshot within provided event range
  commands?: boolean,              // default: true. Narrate pending commands as well.
  rechronicleOptions?: boolean,    // default: {}. Chronicle pending commands on the side.
  receiveTruths?: ReceiveEvents,   // default: connection receiveTruths.
                                   //   Callback for downstream truth events.
  receiveCommands?: ReceiveEvents, // default: receiveTruths. Callback for re-narrated commands
  eventIdBegin?: number,
  eventIdEnd?: number,
  subscribeEvents?: boolean        // if provided will enable or disable event subscriptions.
                                   // TODO(iridian, 2019-01): This (c|sh)ould be extracted to its
                                   // own separate function. Now this flag is awkwardly present
                                   // both here and in ConnectOptions.
};

export type ChronicleOptions = NarrateOptions & {
  isTruth?: boolean,         // If true the chronicled events are already authorized truths.
  retrieveMediaBuffer?: RetrieveMediaBuffer,
};

export class ChronicleEventResult {
  constructor (event, overrides) { this.event = event; Object.assign(this, overrides); }

  event: EventBase; // Preliminary event after universalization
  index: number; // Index of this event result in a result set
  _forwardResults: ChronicleEventResult[];

  // Get a fully universalized event (complete with aspects.log.index if appropriate).
  getUniversalEvent (): EventBase {
    const forward = this._universalForwardResults || this._forwardResults;
    return thenChainEagerly(forward, r => {
      const forwardedResult = r[this.index - (this._events.length - r.length)];
      return forwardedResult && forwardedResult.getUniversalEvent();
    }, this.onError);
  }

  // Get universalized event after it has been processed and reduced
  // through local sourcerer chain, including validations, excluding
  // persistence.
  getLocalEvent (): EventBase | null | Promise<EventBase | null> {
    const forward = this._localForwardResults || this._forwardResults;
    return thenChainEagerly(forward, r => {
      const forwardedResult = r[this.index - (this._events.length - r.length)];
      return forwardedResult && forwardedResult.getLocalEvent();
    }, this.onError);
  }

  // Get event after it has been persisted (possibly locally) but not
  // necessarily authorized.
  getPersistedEvent (): EventBase | Promise<EventBase> {
    const forward = this._persistedForwardResults || this._forwardResults;
    return thenChainEagerly(forward, r => {
      const forwardedResult = r[this.index - (this._events.length - r.length)];
      return forwardedResult && forwardedResult.getPersistedEvent();
    }, this.onError);
  }

  // Get event after it has been confirmed as a truth by its authority
  getTruthEvent (): Truth | Promise<Truth> {
    const forward = this._truthForwardResults || this._forwardResults;
    if (!forward) {
      throw new Error(`getTruthEvent not implemented by ${this.constructor.name}`);
    }
    return thenChainEagerly(forward, r => {
      const forwardedResult = r[this.index - (this._events.length - r.length)];
      return forwardedResult && forwardedResult.getTruthEvent();
    }, this.onError);
  }
}

export type ChronicleRequest = {
  eventResults: ChronicleEventResult[];
}

export class ProphecyEventResult extends ChronicleEventResult {
  story: Story; // Preliminary story before any revisions

  // Returns the partition specific command of this prophecy event
  getCommandOf (/* partitionURI: string */): Command | Promise<Command> {
    throw new Error(`getCommandOf not implemented by ${this.constructor.name}`);
  }

  // Story of the event after its immediate follower reaction promises have resolved.
  getPremiereStory (): Story | Promise<Story> {
    return this.getPersistedStory();
  }

  // Story of the event after it's either (possibly locally) persisted or confirmed as truth.
  getPersistedStory (): Story | Promise<Story> {
    return this.getTruthStory();
  }

  // Story of the event after it's confirmed as a true story by its authority
  getTruthStory (): Story | Promise<Story> {
    throw new Error(`getTruthEvent not implemented by ${this.constructor.name}`);
  }

  // default get*Event implementations which rely on the get*Story

  getUniversalEvent (): EventBase {
    return thenChainEagerly(this.getPremiereStory(), getActionFromPassage);
  }

  getLocalEvent (): EventBase {
    return thenChainEagerly(this.getLocalStory(), getActionFromPassage);
  }

  // Get event after it has been persisted (possibly locally).
  getPersistedEvent (): EventBase | Promise<EventBase> {
    return thenChainEagerly(this.getPersistedStory(), getActionFromPassage);
  }

  // Get event after it has been confirmed as a truth by its authority
  getTruthEvent (): Truth | Promise<Truth> {
    return thenChainEagerly(this.getTruthStory(), getActionFromPassage);
  }
}

export type ProphecyChronicleRequest = {
  eventResults: ProphecyEventResult[];
}
