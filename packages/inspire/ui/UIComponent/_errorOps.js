// @flow

import React from "react";

import type UIComponent from "./UIComponent";

export function _enableError (component: UIComponent, error: string | Error) {
  component._errorObject = error;
  component.setState({ errorHidden: false });
  component.forceUpdate();
  return error;
}

export function _toggleError (component: UIComponent) {
  component.setState({ errorHidden: !component.state.errorHidden });
  component.forceUpdate();
}

export function _clearError (component: UIComponent) {
  component._errorObject = null;
  component.setState({ errorHidden: false });
  component.forceUpdate();
}
