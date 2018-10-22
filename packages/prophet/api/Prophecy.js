// @flow

import type Command from "~/raem/command";
import type { Story } from "~/raem/redux/Bard";

export default class Prophecy {
  story: Story; // The convenience wrapper with top-level event as its prototype
  passage: Story; // The convenience wrapper with possible sub-events as prototype.
                  // If passage corresponds to a virtual sub-event, no prototype exists.
  timed: ?Object;
  state: Object;
  previousState: Object;
  proclamation: ?Command; // Original command, set if this client is the command originator
  timed: ?Object;

  constructor (story: Story, state?: Object, previousState?: Object, proclamation?: Command,
      timed?: Story) {
    this.story = story;
    this.passage = story;
    this.timed = timed;
    this.state = state;
    this.previousState = previousState;
    this.proclamation = proclamation;
  }
}
