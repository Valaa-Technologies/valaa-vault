// @flow

import type { VALKOptions, Story, Passage } from "~/raem";
import { isCreatedLike } from "~/raem/command";

import Vrapper from "~/engine/Vrapper";
import { arrayFromAny } from "~/tools";

export default class FieldUpdate {
  _value: ?any;
  _previousValue: ?any;
  _fieldName: string;

  _emitter: Vrapper;
  _passage: ?Passage;

  _valkOptions: ?Object;
  _explicitValue: any;
  _vProtagonist: ?Vrapper;

  constructor (emitter: Vrapper, fieldName: string, passage: ?Passage,
      valkOptions: ?VALKOptions = {}, explicitValue: any, vProtagonist: ?Vrapper) {
    this._emitter = emitter;
    this._fieldName = fieldName;
    this._passage = passage;
    this._valkOptions = { ...valkOptions };
    this._vProtagonist = vProtagonist;
    this._explicitValue = explicitValue;
  }

  fork (overrides: any) {
    const ret = Object.create(this);
    if (overrides) Object.assign(ret, overrides);
    return ret;
  }

  value (): ?any {
    return this.hasOwnProperty("_value")
        ? this._value
        : (this._value = (typeof this._explicitValue !== "undefined")
            ? this._explicitValue
              // TODO(iridian): The non-pure kueries should be replaced with pure kueries?
            : this._emitter.do(this._fieldName, this._valkOptions));
  }

  previousValue (options: {} = {}) {
    if (!this.hasOwnProperty("_previousValue")) {
      try {
        this._previousValue = this._emitter.do(this._fieldName, this.previousStateOptions(options));
      } catch (error) {
        // TODO(iridian): This is a hacky solution to deal with the situation where previous value
        // did not exist before this event. A proper 'return undefined on undefined resources'
        // solution is needed for the above _emitter.do kuery.
        this._previousValue = undefined;
      }
    }
    return this._previousValue;
  }

  fieldName (): string { return this._fieldName; }
  emitter (): Vrapper { return this._emitter; }
  getPassage (): ?Story { return this._passage; }
  getState (): Object { return this._valkOptions.state; }
  valkOptions (): ?VALKOptions { return this._valkOptions; }
  previousStateOptions (extraOptions: Object = {}): VALKOptions {
    return { ...this._valkOptions, state: this._valkOptions.previousState, ...extraOptions };
  }

  actualAdds () {
    if (!this._passage || isCreatedLike(this._passage)) {
      const value = this.value();
      return arrayFromAny(value || undefined);
    } else if (this._passage.actualAdds) {
      const ids = this._emitter._tryElevateFieldValueFrom(this.getState(), this._fieldName,
          this._passage.actualAdds.get(this._fieldName), this._vProtagonist);
      return this._emitter.engine.getVrappers(ids, this._valkOptions);
    }
    return [];
  }

  // FIXME(iridian): sometimes actualRemoves returns vrappers of the removed entities with state
  // before the removal, in a context dependent fashion.
  // Details: if the far-side resource of the removed coupled field has been accessed earlier and
  // thus has an extant Vrapper that Vrapper is returned and its transient will be updated.
  // Otherwise a new Vrapper corresponding to previousState is returned.
  // The reason the new Vrapper is not pointing to new state is that if the resource was DESTROYED
  // the new state will not have corresponding data.
  actualRemoves () {
    if (!this._passage) return [];
    if (this._passage.actualRemoves) {
      return this._emitter.engine.getVrappers(
          this._passage.actualRemoves.get(this._fieldName), this.previousStateOptions());
    }
    if (this._passage.type === "DESTROYED") {
      // TODO(iridian): .get is getting called twice, redundantly, in the DESTROYED branch.
      // The first call in createFieldUpdate is useless as no actualAdds get made.
      // TODO(iridian): The non-pure kueries should be replaced with pure kueries?
      const value = this._emitter.do(this._fieldName, this.previousStateOptions());
      return arrayFromAny(value || undefined);
    }
    return [];
  }
}
