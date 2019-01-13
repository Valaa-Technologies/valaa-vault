import Cog from "~/engine/Cog";
import { outputError } from "~/tools/wrapError";

// NOTE(iridian, 2018-03): Motor is currently unused, but the base design of TIMED events it relates
// I feel is still sound, so it's not being removed yet.
export default class Motor extends Cog {
  constructor ({ engine, prophet, name, timeDilation }) {
    super({ name });
    this.engine = engine;
    this.prophet = prophet;
    this.engineTime = 0.0;
    this.timeOrigin = undefined;
    this.timeDilation = timeDilation;
    this.futureEventsByTime = {}; // removed dependency to dsjslib
  }

  outputStatus (output) {
    output.log(`${this.name}: engineTime(${this.engineTime}), timeDilation(${this.timeDilation
        }), timeOrigin(${this.timeOrigin}, future events(${this.futureEventsByTime.size}))`);
  }

  start () {
    let previousTime = Date.now();

    let errorCounter = 0;
    const advanceTime = () => {
      try {
        // TODO(iridian): We need to come up with a proper clock solution.
        if (this.engineTime === null) {
          throw new Error(`${this.name}.advanceTime': No engineTime; entrance missing?`);
        }

        const now = Date.now();
        const deltaTimeS = (now - previousTime) / 1000;
        previousTime = now;
        const engineDeltaS = this.advanceTimeBy(deltaTimeS);
        for (const cog of this.engine.cogs) {
          if ((cog !== this.engine) && cog.advanceEngine) {
            cog.advanceEngine(engineDeltaS, this.engineTime);
          }
        }
      } catch (error) {
        errorCounter += 1;
        outputError(error, `Exception #${errorCounter} caught in ${this.debugId()}.advanceTime()`);
      }
      if (errorCounter < 100) {
        requestAnimationFrame(advanceTime);
      } else {
        throw new Error("Terminating Motor.advanceTime loop after 20 errors");
      }
    };
    advanceTime();
  }

  setTimeOrigin (timeOrigin) {
    this.timeOrigin = timeOrigin;
  }

  isPaused () { return this.timeDilation <= 0; }

  setPaused (value = true) {
    if ((!value && (this.timeDilation < 0)) || (value && (this.timeDilation > 0))) {
      this.setTimeDilation(-this.timeDilation);
    }
    if (!value && this.timeDilation === 0) {
      this.setTimeDilation(1);
    }
  }

  getTimeDilation () { return this.timeDilation; }

  setTimeDilation (timeDilation) {
    this.timeDilation = timeDilation;
    console.log(`${this.name}.setTimeDilation(`, timeDilation, "): at ", this.engineTime);
    this.outputStatus(console);
  }

/**
 *
 * @param {any} future
 * @returns The actual time advanced (engine can be paused)
 */
  advanceTimeBy (deltaS) {
    if (this.timeDilation <= 0) return 0;
    const actualDeltaS = deltaS * this.timeDilation;
    const future = this.engineTime + actualDeltaS;
    for (let next = this.futureEventsByTime.min(); next && (next.key < future);
        next = this.futureEventsByTime.min()) {
      this.futureEventsByTime.delete(next.key);
      this.engineTime = next.key;
      // console.log("TIMED expanding", timed.startTime || timed.time, timed);
      next.value.forEach(story => this.prophet.chronicleEvents(story.actions, { timed: story }));
    }
    this.engineTime = future;
    return actualDeltaS;
  }

  onEventTIMED (vResource, story, { timed }) {
    if (timed) {
      const offset = typeof timed.startTime !== "undefined" ? timed.startTime : timed.time;
      if (typeof story.startTime !== "undefined") story.startTime += offset;
      if (typeof story.time !== "undefined") story.time += offset;
    }
    // console.log("TIMED queued", story.startTime || story.time, { story, state, previousState });
    const time = typeof story.startTime !== "undefined" ? story.startTime : story.time;
    let currentEvents = this.futureEventsByTime.get(time);
    if (currentEvents) currentEvents = currentEvents.value;
    else this.futureEventsByTime.put(time, currentEvents = []);
    currentEvents.push(story);
  }

  onEventTRANSACTED (/* dummy, story */) {
    return undefined;
  }
}
