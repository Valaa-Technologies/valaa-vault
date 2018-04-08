import React from "react";
import PropTypes from "prop-types";

import { VRef } from "~/valaa-core/ValaaReference";

import VALEK from "~/valaa-engine/VALEK";
import UIComponent from "~/valaa-inspire/ui/base/UIComponent";
import Vrapper from "~/valaa-engine/Vrapper";
import Presentable from "~/valaa-inspire/ui/base/Presentable";

import beaumpify from "~/valaa-tools/beaumpify";
import notThatSafeEval from "~/valaa-tools/notThatSafeEval";
import wrapError, { outputError } from "~/valaa-tools/wrapError";

// TODO(iridian): Obsoleted and detached.

@Presentable(require("./presentation").default, "VALKConsole") // eslint-disable-line
export default class VALKConsole extends UIComponent {
  static propTypes = {
    ...UIComponent.PropTypes,
    show: PropTypes.bool,
  }

  constructor (props) {
    super(props);
    this.state = {
      tCmd: "",
      cmd: "",
      output: [],
      prevCmds: [],
      prevCmdIndex: -1,
    };
  }

  onKeyDown = (evt) => {
    if (!this.props.show) return;
    // up
    if (evt.keyCode === 38) {
      const newIndex = this.state.prevCmdIndex + 1 >= this.state.prevCmds.length ?
        this.state.prevCmdIndex :
        this.state.prevCmdIndex + 1;
      this.setState({ cmd: this.state.prevCmds[newIndex], prevCmdIndex: newIndex });
    // down
    } else if (evt.keyCode === 40) {
      const newIndex = this.state.prevCmdIndex - 1;
      if (newIndex <= -1) {
        this.setState({ cmd: this.state.tCmd, prevCmdIndex: -1 });
      } else {
        this.setState({ cmd: this.state.prevCmds[newIndex], prevCmdIndex: newIndex });
      }
    }
  }

  componentDidUpdate (prevProps, prevState) {
    if (prevState.output.length !== this.state.output.length) {
      this.outputDiv.scrollTop = this.outputDiv.scrollHeight;
    }
    if (this.props.show !== prevProps.show && this.textInput) {
      if (this.props.show) this.textInput.focus(); else this.textInput.blur();
    }
  }

  handleChange = (event) => {
    this.setState({ cmd: event.target.value, tCmd: event.target.value, prevCmdIndex: -1 });
  }

  handleSubmit = (event) => {
    event.preventDefault();
    let result;
    let newValue = this.state.cmd;
    let errored = false;
    let extraOutput = [{
      txt: `> ${this.state.cmd}`,
      color: "gray",
    }];
    try {
      const selectionIds = [];
      const selection = this.context.engine.getVrappers(selectionIds);
      const evalScope = {
        VALK: VALEK,
        scope: this.getUIContext(),
        focus: !selection || !selection.length ? this.getFocus()
            : selection.length === 1 ? selection[0]
            : selection,
        vrapper: this.context.engine.getVrapper.bind(this.context.engine),
        vrappers: this.context.engine.getVrappers.bind(this.context.engine),
        fields: this.fields,
      };
      let evalResult = notThatSafeEval(evalScope, `return ${this.state.cmd}`);
      if (evalResult instanceof VRef) evalResult = this.context.engine.getVrapper(evalResult);
      const txt = (evalResult instanceof Vrapper)
          ? `${evalResult.debugId()}:\n${beaumpify(evalResult.getTransient())}`
          : JSON.stringify(evalResult, null, 2);
      result = [{ txt, color: "white" }];
      newValue = "";
    } catch (error) {
      errored = true;
      outputError(wrapError(error, `Exception caught in ${this.debugId()}\n .handleSubmit():`,
          "\n\tcommand:", this.state.cmd));
      result = [
        { txt: error.message, color: "red" },
        { txt: "See browser console for more detailed context information", color: "yellow" },
      ];
    }
    extraOutput = [...extraOutput, ...result];
    this.setState({
      output: [...this.state.output, ...extraOutput],
      cmd: newValue,
      tCmd: newValue,
      prevCmdIndex: -1,
      prevCmds: ((this.state.cmd !== this.state.prevCmds[0]) && !errored)
          ? [this.state.cmd, ...this.state.prevCmds]
          : this.state.prevCmds
    });
  }

  render () {
    return (<div // eslint-disable-line
      {...this.presentation("root", { extraContext: { show: this.props.show } })}
      onKeyDown={this.onKeyDown}
    >
      <div {...this.presentation("output")} ref={outputDiv => { this.outputDiv = outputDiv; }}>
        {this.state.output.map(
          (o, i) => <pre key={i} style={{ color: o.color }}>{o.txt}</pre>)}
      </div>
      <form onSubmit={this.handleSubmit} {...this.presentation("inputForm")}>
        <input
          ref={(input) => { this.textInput = input; }}
          {...this.presentation("formInput")}
          type="text"
          value={this.state.cmd}
          onChange={this.handleChange}
        />
      </form>
    </div>);
  }
}
