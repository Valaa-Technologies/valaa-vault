// @flow
import React from "react";

import { unthunkRepeat } from "~/inspire/ui/thunk";
import FieldEditor from "~/inspire/ui/FieldEditor";

export default class TextFieldEditor extends FieldEditor {
  static _defaultPresentation = () => unthunkRepeat(require("./presentation").default);
  preRenderFocus () {
    return (
      <input
        {...this.presentation("textFieldEditor")}
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
    return this.state.pending === undefined
        ? String(this.state.value)
        : String(this.state.pending);
  }

  onKeyDown = (event: Event) => {
    if (event.key === "Escape" || event.key === "Esc") {
      event.stopPropagation();
    }
    if (event.key === "Enter") {
      event.stopPropagation();
      this.enterPressed = true;
      event.target.blur();
    }
  }

  onKeyUp = (event: Event) => {
    if (event.key === "Escape" || event.key === "Esc") {
      event.stopPropagation();
      this.canceling = true;
      event.target.blur();
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
    else if (text !== this.state.value) this.getFocus().setField(this.props.fieldName, text);
    this.setState({ pending: undefined });
  }

  stopPropagation = (event: Event) => { event.stopPropagation(); }
}
