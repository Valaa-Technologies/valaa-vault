// @flow


import type Command, { Action, UniversalEvent } from "~/raem/command";
import type { State } from "~/raem/tools/denormalized/State";
import { isRestrictedCommand } from "~/raem/redux/Bard";

import Prophecy from "~/prophet/api/Prophecy";
import Follower from "~/prophet/api/Follower";
import Prophet, { ClaimResult } from "~/prophet/api/Prophet";
import TransactionInfo from "~/prophet/prophet/TransactionInfo";

import { invariantify, invariantifyObject, invariantifyString } from "~/tools";

import FalseProphetDiscourse from "./FalseProphetDiscourse";
import FalseProphetPartitionConnection from "./FalseProphetPartitionConnection";

import { _fabricateProphecy, _revealProphecyToAllFollowers } from "./_prophecyOps";
import { _receiveTruth, _reviewProphecy } from "./_reformationOps";
import { _claim, _repeatClaim } from "./_claimOps";

/**
 * FalseProphet is non-authoritative (cache) in-memory denormalized store as well as a two-way proxy
 * to backend event streams.
 * In addition to the proxy and cache functionality the main localized responsibility of the
 * FalseProphet is to manage the non-authorized Prophecy queues. When upstream purges some
 * previously dispatched command claim, FalseProphet is responsible for reforming the cache by
 * reviewing and reapplying all commands that come after the purged commands. This reapplication
 * can also include the purged commands themselves if the purge was not a discard but a basic
 * resequencing.
 * Finally, FalseProphet initiates the universalisation process, where so-called restricted commands
 * coming from downstream via .claim (whose meaning is well-defined only in current FalseProphet)
 * get rewritten as universal commands, whose meaning is well-defined for all clients.
 * This process is carried out and more closely documented by @valos/raem/redux/Bard and the
 * reducers contained within the FalseProphet.
 */
export default class FalseProphet extends Prophet {

  static PartitionConnectionType = FalseProphetPartitionConnection;

  _claimOperationQueue = [];

  constructor ({ name, logger, schema, corpus, upstream }: Object) {
    super({ name, logger });
    this.schema = schema;
    this.corpus = corpus;

    // Prophecy queue is a sentinel-based linked list with a separate lookup structure.
    this._prophecySentinel = { id: "sentinel" };
    this._prophecySentinel.next = this._prophecySentinel.prev = this._prophecySentinel;
    this._prophecyByCommandId = {};
    if (upstream) this.setUpstream(upstream);
  }

  setUpstream (upstream) {
    this._upstream = upstream;
    upstream.addFollower(this);
  }

  debugId () { return `${this.constructor.name}(${this.corpus.debugId()})`; }

  getState () { return this.corpus.getState(); }

  recreateCorpus (newState: State) {
    this.corpus.reinitialize(newState);
  }

  _createDiscourse (follower: Follower) {
    return new FalseProphetDiscourse({ prophet: this, follower });
  }

  // Handle a restricted command claim towards upstream.
  claim (restrictedCommand: Command, options:
      { timed: Object, transactionInfo: TransactionInfo } = {}): ClaimResult {
    invariantifyString(restrictedCommand.type, "restrictedCommand.type, with restrictedCommand:",
        { restrictedCommand });
    return _claim(this, restrictedCommand, options);
  }

  // Re-claim commands on application refresh which were cached during earlier executions.
  // The command is already universalized and there's no need to collect handler return values.
  repeatClaim (universalCommand: Command) {
    invariantify(universalCommand.commandId, "repeatClaim.universalCommand.commandId");
    return _repeatClaim(this, universalCommand);
  }

  // Handle event confirmation coming from upstream, including a possible reformation.
  // Sends notifications downstream on the confirmed events.
  // Can also send new command claims upstream if old commands get rewritten during reformation.
  receiveTruth (truthEvent: UniversalEvent, purgedCommands?: Array<UniversalEvent>) {
    return _receiveTruth(this, truthEvent, purgedCommands);
  }

  /**
   * Applies given action (which can be restricted upstream command claim, universalized command
   * replay or a downstream event) to the corpus.
   * Returns a Prophecy object which contains the action itself and the corpus state before and
   * after the action.
   *
   * @param  {type} prophecy  an command to go upstream
   * @returns {type}          description
   */
  _fabricateProphecy (action: Action,
      dispatchDescription: string, timed: ?UniversalEvent = undefined,
      transactionInfo?: TransactionInfo) {
    const restrictedCommand = isRestrictedCommand(action) ? action : undefined;
    try {
      return _fabricateProphecy(this, action, dispatchDescription, timed, transactionInfo,
          restrictedCommand);
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
