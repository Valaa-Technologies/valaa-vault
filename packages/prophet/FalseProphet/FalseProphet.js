// @flow


import { Action, UniversalEvent } from "~/raem/command";
import type { State } from "~/raem/tools/denormalized/State";
import { isProclamation } from "~/raem/redux/Bard";

import Prophecy from "~/prophet/api/Prophecy";
import Follower from "~/prophet/api/Follower";
import Prophet from "~/prophet/api/Prophet";
import TransactionInfo from "~/prophet/FalseProphet/TransactionInfo";

import { invariantify, invariantifyObject, invariantifyString } from "~/tools";

import FalseProphetDiscourse from "./FalseProphetDiscourse";
import FalseProphetPartitionConnection from "./FalseProphetPartitionConnection";

import { _fabricateProphecy, _revealProphecyToAllFollowers } from "./_prophecyOps";
import { _receiveTruth, _reviewProphecy } from "./_reformationOps";
import { _proclaim, _reclaim } from "./_proclamationOps";

export class Proclamation extends Action {}

export type ClaimResult = {
  prophecy: Prophecy;
  getFinalStory: () => Promise<Action>;
  getCommandOf: (partitionURI: string) => Promise<Action>;
  getStoryPremiere: () => Promise<Action>;
}

/**
 * FalseProphet is non-authoritative (cache) in-memory denormalized store as well as a two-way proxy
 * to backend event streams.
 * In addition to the proxy and cache functionality the main localized responsibility of the
 * FalseProphet is to manage the non-authorized Prophecy queues. When upstream purges some
 * previously dispatched proclamation, FalseProphet is responsible for reforming the cache by
 * reviewing and reapplying all commands that come after the purged commands. This reapplication
 * can also include the purged commands themselves if the purge was not a discard but a basic
 * resequencing.
 * Finally, FalseProphet initiates the universalisation process, where proclamations coming from
 * downstream via .proclaim (whose meaning is well-defined only in current FalseProphet)
 * get rewritten as universal commands, whose meaning is well-defined for all clients.
 * This process is carried out and more closely documented by @valos/raem/redux/Bard and the
 * reducers contained within the FalseProphet.
 */
export default class FalseProphet extends Prophet {

  static PartitionConnectionType = FalseProphetPartitionConnection;

  _totalCommandCount: number;
  _claimOperationQueue = [];

  constructor ({ name, logger, schema, corpus, upstream, commandCountCallback }: Object) {
    super({ name, logger });
    this.corpus = corpus;
    this.schema = schema || corpus.getSchema();

    // Prophecy queue is a sentinel-based linked list with a separate lookup structure.
    this._prophecySentinel = { id: "sentinel" };
    this._prophecySentinel.next = this._prophecySentinel.prev = this._prophecySentinel;
    this._prophecyByCommandId = {};
    this._commandCountCallback = commandCountCallback;
    this._partitionCommandCounts = {};
    this._totalCommandCount = 0;
    if (upstream) this.setUpstream(upstream);
  }

  debugId () { return `${this.constructor.name}(${this.corpus.debugId()})`; }

  getState () { return this.corpus.getState(); }

  recreateCorpus (newState: State) {
    this.corpus.reinitialize(newState);
  }

  _createDiscourse (follower: Follower) {
    return new FalseProphetDiscourse({ prophet: this, follower });
  }

  // Process and transmit a proclamation towards upstream.
  proclaim (proclamation: Proclamation, options:
      { timed: Object, transactionInfo: TransactionInfo } = {}): ClaimResult {
    invariantifyString(proclamation.type, "proclamation.type, with proclamation:",
        { proclamation });
    return _proclaim(this, proclamation, options);
  }

  // Reclaim commands on application refresh which were cached during earlier executions.
  // The command is already universalized and there's no need to collect handler return values.
  repeatClaim (proclamation: Proclamation) {
    invariantify(proclamation.commandId, "repeatClaim.proclamation.commandId");
    return _reclaim(this, proclamation);
  }

  // Handle event confirmation coming from upstream, including a possible reformation.
  // Sends notifications downstream on the confirmed events.
  // Might result in proclamation reclaims and thus fresh upstream command chroniclings.
  receiveTruth (truthEvent: UniversalEvent, purgedCommands?: Array<UniversalEvent>) {
    return _receiveTruth(this, truthEvent, purgedCommands);
  }

  /**
   * Applies given action (which can be a downstream event or an upstream proclamation or command
   * reclaim.
   * Returns a Prophecy object which contains the action itself and the corpus state before and
   * after the action.
   *
   * @param  {type} prophecy  an command to go upstream
   * @returns {type}          description
   */
  _fabricateProphecy (action: Action, dispatchDescription: string, timed: ?UniversalEvent,
      transactionInfo?: TransactionInfo) {
    try {
      return _fabricateProphecy(this, action, dispatchDescription, timed, transactionInfo);
    } catch (error) {
      throw this.wrapErrorEvent(error, `_fabricateProphecy(${dispatchDescription})`,
          "\n\taction:", action,
          "\n\ttimed:", timed);
    }
  }

  _reviewProphecy (reformation: Object, oldProphecy: Prophecy) {
    try {
      _reviewProphecy(this, reformation, oldProphecy);
    } catch (error) {
      // Hard conflict. The new incoming truth has introduced a low-level conflicting change,
      // such as destroying a resource which the prophecies modify.
      oldProphecy.conflictReason = error;
    }
  }

  _revealProphecyToAllFollowers (prophecy: Prophecy) {
    invariantifyObject(prophecy, "_revealProphecyToAllFollowers.prophecy",
        { instanceof: Prophecy, allowNull: false, allowEmpty: false });
    return _revealProphecyToAllFollowers(this, prophecy);
  }

  // command ops

  setConnectionCommandCount (connectionName: Object, value: number = 1) {
    const previous = this._partitionCommandCounts[connectionName] || 0;
    this._partitionCommandCounts[connectionName] = value;
    this._totalCommandCount += (value - previous);
    if (this._commandCountCallback) {
      this._commandCountCallback(this._totalCommandCount, this._partitionCommandCounts);
    }
  }

  _dumpStatus () {
    const ids = [];
    for (let c = this._prophecySentinel.next; c !== this._prophecySentinel; c = c.next) {
      ids.push(c.id);
    }
    return [
      "\n\tpending:", Object.keys(this._prophecyByCommandId).length,
          { ...this._prophecyByCommandId },
      "\n\tcommandIds:", ids,
    ];
  }
}
