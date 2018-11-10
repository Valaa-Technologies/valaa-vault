// @flow

import { Story } from "~/raem";

/**
 * An intrusive linked ring structure of Story objects with sentinel as
 * one-before-first and one-after-last link.
 *
 * @export
 * @class StoryTelling
 */
export default class StoryTelling {
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
  getFirst () { return this.next; }
  getLast () { return this.prev; }
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
      if (story.commandId) {
        this._storyByCommandId[story.commandId] = story;
      }
    }
  }

  // If no before is specified, extracts all stories to the end of the telling.
  extractStoryChain (firstStory: Story, allBefore: Story = this) {
    if (firstStory.id === "sentinel") throw new Error("cannot extract sentinel");
    if (firstStory === allBefore) return undefined;
    const lastStory = allBefore.prev;
    allBefore.prev = firstStory.prev;
    allBefore.prev.next = allBefore;
    firstStory.prev = lastStory;
    lastStory.next = null;
    for (let story = firstStory; story; story = story.next) {
      if (story.commandId) delete this._storyByCommandId[story.commandId];
    }
    return allBefore;
  }

  dumpStatus () {
    const ids = [];
    for (let c = this.next; c !== this; c = c.next) {
      ids.push(c.id || c.commandId);
    }
    return [
      "\n\tpending:", Object.keys(this._storyByCommandId).length,
          { ...this._storyByCommandId },
      "\n\tcommandIds:", ids,
    ];
  }
}
