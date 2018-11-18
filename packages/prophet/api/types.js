// @flow

import { Command, EventBase, Truth } from "~/raem/events";
import { VRef } from "~/raem/ValaaReference";
import { getActionFromPassage, Story } from "~/raem/redux/Bard";

import thenChainEagerly from "~/tools/thenChainEagerly";

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
};

export type ChronicleOptions = NarrateOptions & {
  isTruth?: boolean,         // If true the chronicled events are already authorized truths.
  retrieveMediaBuffer?: RetrieveMediaBuffer,
};

export class ChronicleEventResult {
  constructor (event, overrides) { this.event = event; Object.assign(this, overrides); }

  event: EventBase; // Preliminary event after universalization

  // Get a fully universalized event (complete with logIndex if appropriate).
  getUniversalEvent (): EventBase {
    return this.getPersistedEvent();
  }

  // Get universalized event after it has been processed through local prophet chain.
  getLocalEvent (): EventBase | null | Promise<EventBase | null> {
    throw new Error(`getLocalEvent not implemented by ${this.constructor.name}`);
  }

  // Get event after it has been persisted (possibly locally).
  getPersistedEvent (): EventBase | Promise<EventBase> {
    return this.getTruthEvent();
  }

  // Get event after it has been confirmed as a truth by its authority
  getTruthEvent (): Truth | Promise<Truth> {
    throw new Error(`getTruthEvent not implemented by ${this.constructor.name}`);
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

  // Story of the event after it's persisted (possibly locally) but not yet authorized.
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
