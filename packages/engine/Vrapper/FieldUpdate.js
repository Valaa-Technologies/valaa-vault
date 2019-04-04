// @flow

import { isCreatedLike } from "~/raem/events";
import type { Story, Passage } from "~/raem/redux/Bard";
import type { VALKOptions } from "~/raem/VALK";

import Vrapper from "~/engine/Vrapper";

import { arrayFromAny } from "~/tools";

export class LiveUpdate {
  _emitter: Vrapper;
  _valkOptions: ?Object;
  _value: ?any;
  _fieldName: string;
  _passage: ?Passage;

  constructor (emitter: Vrapper, valkOptions: ?VALKOptions) {
    this._emitter = emitter;
    this._valkOptions = !valkOptions ? {} : { ...valkOptions };
  }

  debugId (options: ?Object): string {
    return `${this.constructor.name}(${this._emitter && this._emitter.debugId(options)})`;
  }

  getEmitter (): Vrapper { return this._emitter; }
  getOptions (): ?VALKOptions { return this._valkOptions; }
  getDiscourse () { return this._valkOptions.discourse || this._emitter.engine.discourse; }
  getState (): Object { return this._valkOptions.state || this.getDiscourse().getState(); }
  getJSState (): Object { return this.getState().toJS(); }
  value (): ?any {
    return (this._value !== undefined) ? this._value : (this._value = this._resolveValue());
  }

  // FieldUpdate / field Subscription properties

  fieldName (): string { return this._fieldName; }
  getPassage (): ?Story { return this._passage; }
  previousStateOptions (extraOptions: Object = {}): VALKOptions {
    return {
      ...this._valkOptions,
      state: this._passage ? this._passage.previousState : this._valkOptions.previousState,
      ...extraOptions,
    };
  }
  clearPassageTemporaries () {
    this._passage = null;
    if (this._passages) this._passages = null;
    if (this._cachedAddsAndRemoves) this._cachedAddsAndRemoves = null;
  }

  _resolveValue (): ?any {
    // TODO(iridian): The non-pure kueries should be replaced with pure kueries?
    return this._emitter.do(this._fieldName, this._valkOptions);
  }

  /*
  _previousValue: ?any;
  previousValue (options: {} = {}) {
    if (!this.hasOwnProperty("_previousValue")) {
      try {
        this._previousValue = this._emitter.do(this._fieldName, this.previousStateOptions(options));
      } catch (error) {
        // TODO(iridian): This is a hacky solution to deal with the
        // situation where previous value did not exist before this
        // event. A proper 'return undefined on undefined resources'
        // solution is needed for the above _emitter.do kuery.
        this._previousValue = undefined;
      }
    }
    return this._previousValue;
  }
  */

  actualAdds () {
    return (this._cachedAddsAndRemoves || this._resolveAddsAndRemoves()).adds || [];
  }

  actualRemoves () {
    return (this._cachedAddsAndRemoves || this._resolveAddsAndRemoves()).removes || [];
  }

  _resolveAddsAndRemoves () {
    if (!this._passage) {
      return { adds: this._actualAddsOfPassage({ state: this.getState() }) };
    }
    if (!this._passages) {
      return this._cachedAddsAndRemoves = {
        adds: this._actualAddsOfPassage(this._passage),
        removes: this._actualRemovesOfPassage(this._passage),
      };
    }
    const cache = this._cachedAddsAndRemoves = { adds: new Set(), removes: new Set() };
    for (const passage of this._passages) {
      for (const remove of (this._actualRemovesOfPassage(passage) || [])) {
        cache.adds.delete(remove); cache.removes.add(remove);
      }
      for (const add of (this._actualAddsOfPassage(passage) || [])) {
        cache.removes.delete(add); cache.adds.add(add);
      }
    }
    return cache;
  }

  _actualAddsOfPassage (passage: Object) {
    if (!passage.type || isCreatedLike(passage)) {
      const value = this.value();
      if (value) return arrayFromAny(value);
    } else if (passage.actualAdds) {
      const adds = passage.actualAdds.get(this._fieldName);
      if (adds && adds.length) {
        const ids = this._emitter._tryElevateFieldValueFrom(
            passage.state, this._fieldName, adds, passage.vProtagonist);
        return this._emitter.engine.getVrappers(ids, passage);
      }
    }
    return undefined;
  }

  // FIXME(iridian): sometimes actualRemoves returns vrappers of the
  // removed entities with state before the removal, in a context
  // dependent fashion.
  // Details: if the far-side resource of the removed coupled field has
  // been accessed earlier and thus has an extant Vrapper that Vrapper
  // is returned and its transient will be updated.
  // Otherwise a new Vrapper corresponding to previousState is returned.
  // The reason the new Vrapper is not pointing to new state is that if
  // the resource was DESTROYED the new state will not have
  // corresponding data.
  _actualRemovesOfPassage (passage: Object) {
    if (!passage.type) return undefined;
    if (passage.actualRemoves) {
      const removes = passage.actualRemoves.get(this._fieldName);
      if (removes && removes.length) {
        return this._emitter.engine.getVrappers(removes, { state: passage.previousState });
      }
    } else if (passage.type === "DESTROYED") {
      // TODO(iridian): .get is getting called twice, redundantly, in
      // the DESTROYED branch. The first call in createFieldUpdate is
      // useless as no actualAdds get made.
      // TODO(iridian): The non-pure kueries should be replaced with
      // pure kueries?
      const value = this._emitter.do(this._fieldName, { state: passage.previousState });
      if (value) return arrayFromAny(value);
    }
    return undefined;
  }
}
