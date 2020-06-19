// @flow
import React from "react";

import { unthunkRepeat } from "~/inspire/ui/thunk";
import FieldEditor from "~/inspire/ui/FieldEditor";
import Vrapper from "~/engine/Vrapper";
import VALEK, { literal } from "~/engine/VALEK";

export default class ExpressionFieldEditor extends FieldEditor {
  static _defaultPresentation = () => unthunkRepeat(require("./presentation").default);
  preRenderFocus () {
    return (
      <input
        {...this.presentation("expressionFieldEditor")}
        type="text"
        value={this.shownValue()}
        onKeyDown={this.onKeyDown}
        onKeyUp={this.onKeyUp}
        onChange={this.onChange}
        onBlur={this.onBlur}
        onDoubleClick={this.stopPropagation}
      />
    );
  }

  shownValue () {
    const rawValue = this.state.pending === undefined
        ? this.state.value
        : this.state.pending;
    if (rawValue instanceof Vrapper) {
      // XXX This branch of the function is close to what the previous ValueEditor did to show its
      //     values (once you took into consideration the props passed and parent classes' code)
      //     but it doesn't seem to be triggered often. Should anything here break, just assume I
      //     had no idea I was doing and redo this bit. (thiago)
      const vakon = rawValue.step(VALEK.evalk(VALEK.to("asVAKON")));
      return vakon;
    }
    if (rawValue instanceof Object) {
      return String(rawValue.value) || "";
    }
    return String(rawValue) || "";
  }

  onKeyDown = (event: Event) => {
    if (event.key === "Enter") {
      this.enterPressed = true;
      event.target.blur();
    }
  }

  onKeyUp = (event: Event) => {
    if (event.key === "Escape" || event.key === "Esc") {
      this.canceling = true;
      event.target.blur();
      event.stopPropagation();
    }
  }

  onChange = (event: Event) => {
    this.setState({ pending: event.target.value });
    event.stopPropagation();
  }

  onBlur = (event: Event) => {
    this.saveValue(event.target.value);
    event.stopPropagation();
  }

  saveValue (text: string) {
    if (this.canceling) this.canceling = false;
    else {
      const number = Number(text);
      if (isNaN(number)) this.getFocus().setField(this.props.fieldName, literal(text));
      else this.getFocus().setField(this.props.fieldName, literal(number));
    }
    this.setState({ pending: undefined });
  }

  stopPropagation = (event: Event) => { event.stopPropagation(); }
}
