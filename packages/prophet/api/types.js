// @flow

import type { EventBase } from "~/raem/command";
import { VRef } from "~/raem/ValaaReference";

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
  type: "CREATED" | "MODIFIED" | "FIELDS_SET" | "ADDED_TO" | "REMOVED_FROM" | "REPLACED_WITHIN"
      | "SPLICED" | "TRANSACTED" | "FROZEN"
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
  firstEventId?: number,
  lastEventId?: number,
};

export type ChronicleOptions = NarrateOptions & {
  isPreAuthorized?: boolean,         // If true the chronicled events are already authorized truths.
  retrieveMediaBuffer?: RetrieveMediaBuffer,
};

export type ChronicleEventResult = {
  event: EventBase,
  getLocallyReceivedEvent: Function<Promise<EventBase> >,
  getTruthEvent: Function<Promise<EventBase> >,
};
