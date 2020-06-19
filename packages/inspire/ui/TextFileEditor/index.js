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

import { unthunkRepeat } from "~/inspire/ui/thunk";
import MediaContentEditor from "~/inspire/ui/MediaContentEditor";

import { beaumpify } from "~/tools";

export default class TextFileEditor extends MediaContentEditor {
  static _defaultPresentation = () => unthunkRepeat(require("./presentation").default);
  static propTypes = {
    ...MediaContentEditor.propTypes,
    confirmSave: PropTypes.func,
  };

  preRenderFocus () {
    return (
      <div
        onKeyDown={this.onKeyDown}
        onKeyUp={this.onKeyUp}
        style={{ width: "100%", height: "100%" }}
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
      </div>
    );
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

  UNSAFE_componentWillReceiveProps () { // eslint-disable-line
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
        "\n\tstate.content:", this.state.content,
        "\n\tfocus:", this.getFocus(),
        `\n\tfocus.step(VALEK.interpretContent({ contentType: "text/plain"})):`,
            this.getFocus().step(VALEK.interpretContent({ contentType: "text/plain" })));
    throw new Error(`TextFileEditor given invalid non-string content:\n${
        beaumpify(this.state.content)}`);
  }

  saveContent = async (text: string) => {
    const target = this.getFocus();
    if (!target) throw new Error(`TextfileEditor.saveContent called with '${typeof target}' focus`);
    if (typeof text !== "string") {
      throw new Error(
          `Invalid text when saving TextFileEditor content, expected string, got ${typeof text}`);
    }
    const discourse = target.acquireFabricator("save-text-content");
    try {
      const oldText = (this.state || {}).content;
      if ((text === oldText)
          || (this.props.confirmSave && !this.props.confirmSave(text, oldText))) {
        return;
      }
      const createBvob = await target.prepareBvob(text, { discourse });
      target.setField("content", createBvob(), { discourse });
      discourse.releaseFabricator();
    } catch (error) {
      if (discourse.isCommittable && discourse.isCommittable()) {
        discourse.releaseFabricator({ rollback: error });
      }
      throw error;
    }
  }

  getEditorMode () {
    const mediaType = mediaTypeFromFilename(this.getFocus().step("name"));
    if (mediaType) {
      switch (mediaType.subtype) {
        // Inspire extensions:
        case "valoscript": return "javascript";
        case "valaascript": return "javascript";
        case "vsx": return "jsx";
        default: return mediaType.subtype;
      }
    }
    return "markdown";
  }
}
