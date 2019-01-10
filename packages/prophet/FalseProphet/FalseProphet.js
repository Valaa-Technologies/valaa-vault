// @flow

import { Command, EventBase } from "~/raem/events";
import type { Story } from "~/raem/redux/Bard";
import type { State } from "~/raem/state";
import type { JSONIdData, VRef } from "~/raem/ValaaReference";

import Follower from "~/prophet/api/Follower";
import Prophet from "~/prophet/api/Prophet";
import TransactionInfo from "~/prophet/FalseProphet/TransactionInfo";
import { ChronicleOptions, ChroniclePropheciesRequest, ProphecyEventResult }
    from "~/prophet/api/types";

import { dumpObject } from "~/tools";

import FalseProphetDiscourse from "./FalseProphetDiscourse";
import FalseProphetPartitionConnection from "./FalseProphetPartitionConnection";

import { Prophecy, _chronicleEvents } from "./_prophecyOps";
import { _composeStoryFromEvent, _reviseSchismaticRecital, _tellStoriesToFollowers }
    from "./_storyOps";
import { deserializeVRef } from "./_universalizationOps";
import StoryRecital from "./StoryRecital";

type FalseProphetChronicleOptions = ChronicleOptions & {
  reviseSchism?: (schism: Prophecy, connection: FalseProphetPartitionConnection,
      purgedCommands: Command[], newEvents: Command[]) => Prophecy,
};

/**
 * FalseProphet is non-authoritative denormalized in-memory store of
 * ValOS state representations (corpus) and a two-way proxy to backend
 * event streams.
 *
 * In addition FalseProphet manages an internal prophecy and story
 * queue as a central component of event revisioning and operational
 * transformations. When upstream purges some previously chronicled
 * commands, FalseProphet is responsible for reforming the cache by
 * revisioning all commands that have been reduced to the corpus after
 * the come after the purged commands.
 *
 * Finally, FalseProphet initiates the universalisation process, where
 * commands coming from downstream via .chronicleEvents (whose meaning
 * is well-defined only in current FalseProphet context) get rewritten
 * as universal commands so that their meaning is well-defined for all
 * clients. This process is carried out and more closely documented by
 * @valos/raem/redux/Bard and the reducers contained within the corpus.
 */
export default class FalseProphet extends Prophet {
  static PartitionConnectionType = FalseProphetPartitionConnection;

  _totalCommandCount: number;

  _primaryRecital: StoryRecital;

  _onCommandCountUpdate: Function<>;
  _partitionCommandCounts: Object = {};
  _totalCommandCount: number = 0;
  _inactivePartitionVRefPrototypes: { [partitionURI: string]: VRef } = {};

  constructor ({
    schema, corpus, upstream, onCommandCountUpdate, ...rest
  }: Object) {
    super(rest);
    this.corpus = corpus;
    corpus.setDeserializeReference(this.deserializeReference);
    this.schema = schema || corpus.getSchema();

    // Story queue is a sentinel-based linked list with a separate lookup structure.
    this._primaryRecital = new StoryRecital(undefined, "main");
    this._onCommandCountUpdate = onCommandCountUpdate;
    if (upstream) this.setUpstream(upstream);
  }

  debugId () { return `${this.constructor.name}(${this.corpus.debugId()})`; }

  getState () { return this.corpus.getState(); }

  setCommandCountCallback (callback: Function) {
    this._onCommandCountUpdate = callback;
    callback(this._totalCommandCount, this._partitionCommandCounts);
  }

  recreateCorpus (newState: State) {
    this.corpus.reinitialize(newState);
  }

  _createDiscourse (follower: Follower) {
    return new FalseProphetDiscourse({ prophet: this, follower });
  }

  // Split a command and transmit resulting partition commands towards upstream.
  chronicleEvents (commands: Command[], options: FalseProphetChronicleOptions = {}):
      ChroniclePropheciesRequest {
    try {
      return _chronicleEvents(this, commands, options);
    } catch (error) {
      throw this.wrapErrorEvent(error, "chronicleEvents()",
          "\n\toptions:", ...dumpObject(options));
    }
  }

  chronicleEvent (event: EventBase, options: Object = {}): ProphecyEventResult {
    return this.chronicleEvents([event], options).eventResults[0];
  }


  /**
   * Dispatches given event to the corpus and get the corresponding
   * story. This event can be a downstream-bound truth, a fresh
   * upstream-bound command, cached command narration or an existing
   * prophecy revision.
   * Returns a story which contains the action itself and the corpus
   * state before and after the action.
   *
   * @param  {type} event     an command to go upstream
   * @returns {type}          description
   */
  _composeStoryFromEvent (event: EventBase, dispatchDescription: string, timed: ?EventBase,
      transactionInfo?: TransactionInfo) {
    try {
      return _composeStoryFromEvent(this, event, dispatchDescription, timed, transactionInfo);
    } catch (error) {
      throw this.wrapErrorEvent(error, `_composeStoryFromEvent(${dispatchDescription})`,
          "\n\tevent:", ...dumpObject(event),
          "\n\ttimed:", ...dumpObject(timed));
    }
  }

  _reviseSchismaticRecital (schismaticRecital: Prophecy, reviewedPartitions: Object,
      originatingConnection: FalseProphetPartitionConnection, purgedCommands: Command[],
      newEvents: Command[]): Story[] {
    try {
      return _reviseSchismaticRecital(this, schismaticRecital, reviewedPartitions,
          originatingConnection, purgedCommands, newEvents);
    } catch (error) {
      throw this.wrapErrorEvent(error, `_reviseSchismaticRecital(${schismaticRecital.id})`,
          "\n\tschismatic recital:", ...dumpObject(schismaticRecital),
          "\n\treviewed partitions:", ...dumpObject(reviewedPartitions),
          "\n\toriginating connection:", ...dumpObject(originatingConnection),
          "\n\tpurged commands:", ...dumpObject(purgedCommands),
          "\n\tnew events:", ...dumpObject(newEvents));
    }
  }

  _tellStoriesToFollowers (stories: Story[]) {
    let releaseNotificationDelayer;
    try {
      this.setCommandNotificationDelayer(
          new Promise(resolve => { releaseNotificationDelayer = resolve; }));
      return _tellStoriesToFollowers(this, stories);
    } catch (error) {
      throw this.wrapErrorEvent(error, new Error(`_tellStoriesToFollowers()`),
          "\n\tstories:", ...dumpObject(stories));
    } finally {
      releaseNotificationDelayer();
    }
  }

  // command ops

  setConnectionCommandCount (connectionName: Object, value: number = 1) {
    const previous = this._partitionCommandCounts[connectionName] || 0;
    this._partitionCommandCounts[connectionName] = value;
    this._totalCommandCount += (value - previous);
    if (!this._onCommandCountUpdate || this._pendingCommandCountUpdateNotification) return;
    this._pendingCommandCountUpdateNotification = true;
    if (!this._commandNotificationDelayer) {
      // Even with no current delayer postpone the notifications to top event handler
      this.setCommandNotificationDelayer(Promise.resolve(true));
    }
    this._mostRecentNotification = this._commandNotificationDelayer.then(() => {
      // only notify if there is no blocking delayer
      if (this._commandNotificationDelayer) return;
      try {
        this._onCommandCountUpdate(this._totalCommandCount, this._partitionCommandCounts);
      } finally {
        this._pendingCommandCountUpdateNotification = false;
        this.setCommandNotificationDelayer(new Promise(resolve => setTimeout(resolve, 500)));
      }
    });
  }

  setCommandNotificationDelayer (delayer) {
    const newDelayer = delayer.then(() => {
      // clear delayer only if this delayer was the latest delayer
      if (this._commandNotificationDelayer === newDelayer) this._commandNotificationDelayer = null;
    });
    this._commandNotificationDelayer = newDelayer;
  }

  _dumpStatus () {
    return this._primaryRecital.dumpStatus();
  }

  deserializeReference = (serializedReference: JSONIdData, currentPartitionURI?: string) => {
    try {
      return deserializeVRef(serializedReference, currentPartitionURI, this);
    } catch (error) {
      throw this.wrapErrorEvent(error, new Error("deserializeReference"),
          "\n\tserializedReference:", ...dumpObject(serializedReference),
          "\n\tcurrentPartitionURI:", ...dumpObject(currentPartitionURI));
    }
  }
}
