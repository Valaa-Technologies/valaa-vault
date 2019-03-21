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

  constructor (emitter: Vrapper, valkOptions: ?VALKOptions) {
    this._emitter = emitter;
    this._valkOptions = !valkOptions ? {} : { ...valkOptions };
  }

  debugId (options: ?Object): string {
    return `${this.constructor.name}(${this._emitter && this._emitter.debugId(options)})`;
  }

  getEmitter (): Vrapper { return this._emitter; }
  valkOptions (): ?VALKOptions { return this._valkOptions; }
  getState (): Object { return this._valkOptions.state; }
  value (): ?any {
    return (this._value !== undefined) ? this._value : (this._value = this._resolveValue());
  }

  // FieldUpdate / field Subscription properties

  _fieldName: string;
  _passage: ?Passage;

  fieldName (): string { return this._fieldName; }
  getPassage (): ?Story { return this._passage; }
  previousStateOptions (extraOptions: Object = {}): VALKOptions {
    return { ...this._valkOptions, state: this._valkOptions.previousState, ...extraOptions };
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
    if (!this._passage || isCreatedLike(this._passage)) {
      const value = this.value();
      return arrayFromAny(value || undefined);
    }
    if (this._passage.actualAdds) {
      const ids = this._emitter._tryElevateFieldValueFrom(this.getState(), this._fieldName,
          this._passage.actualAdds.get(this._fieldName), this._passage.vProtagonist);
      return this._emitter.engine.getVrappers(ids, this._valkOptions);
    }
    return [];
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
  actualRemoves () {
    if (!this._passage) return [];
    if (this._passage.actualRemoves) {
      return this._emitter.engine.getVrappers(
          this._passage.actualRemoves.get(this._fieldName), this.previousStateOptions());
    }
    if (this._passage.type === "DESTROYED") {
      // TODO(iridian): .get is getting called twice, redundantly, in
      // the DESTROYED branch. The first call in createFieldUpdate is
      // useless as no actualAdds get made.
      // TODO(iridian): The non-pure kueries should be replaced with
      // pure kueries?
      const value = this._emitter.do(this._fieldName, this.previousStateOptions());
      return arrayFromAny(value || undefined);
    }
    return [];
  }
}

export default class FieldUpdate extends LiveUpdate {
  constructor (emitter: Vrapper, fieldName: string, passage: ?Passage, story: ?Story) {
    super(emitter, story);
    this._fieldName = fieldName;
    this._passage = passage;
  }
}
