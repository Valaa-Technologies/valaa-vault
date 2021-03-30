// @flow

import type { Story } from "~/raem/redux/Bard";
import { tryAspect } from "~/sourcerer/tools/EventAspects";

/**
 * A recital is an ordered list of Story objects.
 * It is an intrusive linked ring structure of Story objects with
 * sentinel as one-before-first and one-past-last link.
 *
 * It also maintains a lookup structure from story aspects.command.id
 * to individual link Story objects.
 *
 * @export
 * @class StoryRecital
 */
export default class StoryRecital {
  id: string;
  _storyByCommandId = {};

  constructor (storyChain: ?Story, id: string = "sentinel") {
    this.id = id;
    this.next = this.prev = this;
    if (storyChain) this.insertStoryChain(storyChain);
  }

  [Symbol.iterator] () {
    let value = this;
    return { next: () => (value = value.next) && { done: value === this, value } };
  }
  forEach (callback: Function) {
    let i = 0;
    for (let e = this.next; e !== this; e = e.next) callback(e, i++, this);
  }
  map (callback: Function) {
    const ret = [];
    let i = 0;
    for (let e = this.next; e !== this; e = e.next) ret.push(callback(e, i++, this));
    return ret;
  }

  push (...stories: Story) { stories.forEach(story => this.addStory(story)); }
  pop () { return this.removeStory(this.prev); }
  unshift (...stories: Story) {
    const beforeFirst = this.next;
    stories.forEach(story => this.addStory(story, beforeFirst));
  }
  shift () { return this.removeStory(this.next); }
  get size () { return Object.keys(this._storyByCommandId).length; }

  getFirst () { return this.next; }
  getLast () { return this.prev; }

  isEmpty () { return this.next === this; }

  getStoryBy (commandId: string) { return this._storyByCommandId[commandId]; }

  addStory (story: Story, before: Story = this) {
    if (story.prev !== story) {
      if (story.prev) throw new Error("Cannot add a story which is still linked");
      story.prev = story;
    }
    return this.insertStoryChain(story, before);
  }
  // Returns the entry after the removed story.
  removeStory (story: Story) { return this.extractStoryChain(story, story.next); }

  insertStoryChain (storyChain: Story, before: Story = this) {
    if (!storyChain.prev) throw new Error("storyChain.prev must be non-null");
    const lastStory = storyChain.prev;
    storyChain.prev = before.prev;
    storyChain.prev.next = storyChain;
    before.prev = lastStory;
    before.prev.next = before;
    for (let story = storyChain; story !== before; story = story.next) {
      const commandId = tryAspect(story, "command").id;
      if (commandId) this._storyByCommandId[commandId] = story;
    }
  }

  // If no before is specified, extracts all stories to the end of the
  // recital.
  extractStoryChain (firstStory: Story, allBefore: Story = this) {
    if (firstStory.id === "sentinel") {
      throw new Error("cannot remove sentinel (possibly empty recital)");
    }
    if (firstStory === allBefore) return undefined;
    const lastStory = allBefore.prev;
    allBefore.prev = firstStory.prev;
    allBefore.prev.next = allBefore;
    firstStory.prev = lastStory;
    lastStory.next = null;
    for (let story = firstStory; story; story = story.next) {
      const commandId = tryAspect(story, "command").id;
      if (commandId) delete this._storyByCommandId[commandId];
    }
    return allBefore;
  }

  dumpStatus () {
    const ids = [];
    for (let c = this.next; c !== this; c = c.next) {
      ids.push(c.id || (((c.aspects || {}).command || {}).id));
    }
    return [
      "\n\tpending:", Object.keys(this._storyByCommandId).length,
          { ...this._storyByCommandId },
      "\n\tcommandId's:", ids,
    ];
  }
}
