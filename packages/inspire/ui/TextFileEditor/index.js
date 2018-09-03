// @flow
import PropTypes from "prop-types";
import React from "react";
import AceEditor from "react-ace";
import brace from "brace"; // eslint-disable-line
import "brace/mode/css";
import "brace/mode/html";
import "brace/mode/javascript";
import "brace/mode/json";
import "brace/mode/jsx";
import "brace/mode/xml";
import "brace/mode/markdown";
import "brace/theme/tomorrow_night";
import "brace/ext/language_tools";

import VALEK from "~/engine/VALEK";

import { mediaTypeFromFilename } from "~/tools/MediaTypeData";

import Presentable from "~/inspire/ui/Presentable";
import MediaContentEditor from "~/inspire/ui/MediaContentEditor";

import { beaumpify } from "~/tools";

@Presentable(require("./presentation").default, "TextFileEditor")
export default class TextFileEditor extends MediaContentEditor {

  static propTypes = {
    ...MediaContentEditor.propTypes,
    confirmSave: PropTypes.func,
  };

  preRenderFocus () {
    return (
      <div
        onKeyDown={this.onKeyDown} onKeyUp={this.onKeyUp} style={{ width: "100%", height: "100%" }}
      >
        <AceEditor
          onLoad={this.setEditor}
          onBlur={this.onBlur}
          value={this.getContent()}
          mode={this.getEditorMode()}
          theme="tomorrow_night"
          width="100%"
          height="100%"
        />
      </div>);
  }

  setEditor = (editor: Object) => {
    this.editor = editor;
    this.editor.setValue(this.getContent());
  }

  onKeyDown = (event: Event) => {
    if ((event.key === "Escape") || (event.key === "Esc")) {
      event.stopPropagation();
    }
  }

  onKeyUp = (event: Event) => {
    if ((event.key === "Escape") || (event.key === "Esc")) {
      event.stopPropagation();
      event.target.blur();
    }
  }

  onBlur = (/* event: Event */) => {
    this.saveContent(this.editor.getValue());
  }

  componentWillReceiveProps () {
    const text = this.editor && this.editor.getValue();
    if (text) this.saveContent(text);
  }

  componentDidUpdate (prevProps, prevState) {
    if (prevState.content === undefined) {
      const undoManager = this.editor.getSession().getUndoManager();
      undoManager.reset();
      this.editor.getSession().setUndoManager(undoManager);
    }
  }

  getContent = () => {
    if (!this.state.content) return "";
    if (typeof this.state.content === "string") return this.state.content;
    console.warn(this.debugId(), "TextFileEditor.getContent: invalid non-text content:",
        this.state.content);
    console.warn("\t", this.getFocus().get(VALEK.interpretContent({ mime: "text/plain" })));
    throw new Error(`TextFileEditor given invalid non-string content:\n${
        beaumpify(this.state.content)}`);
  }

  saveContent = async (text: string) => {
    const target = this.getFocus();
    if (!target) throw new Error(`TextfileEditor.saveContent called with '${typeof target}' focus`);
    const transaction = target.acquireTransaction();
    try {
      if ((this.props.confirmSave && !this.props.confirmSave(text, (this.state || {}).content))
          || (this.state.content === text)) {
        return;
      }
      const createBvob = await target.prepareBvob(text, { transaction });
      target.setField("content", createBvob(), { transaction });
      transaction.releaseTransaction();
    } finally {
      if (transaction.isCommittable && transaction.isCommittable()) transaction.abort();
    }
  }

  getEditorMode () {
    const mediaType = mediaTypeFromFilename(this.getFocus().get("name"));
    if (mediaType) {
      switch (mediaType.subtype) {
        // Inspire extensions:
        case "valaascript": return "javascript";
        case "vsx": return "jsx";
        default: return mediaType.subtype;
      }
    }
    return "markdown";
  }
}
