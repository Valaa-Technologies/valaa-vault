// @flow

import type UIComponent from "./UIComponent";

export function _enableError (component: UIComponent, error: string | Error) {
  component._stickyErrorObject = error;
  component.flushAndRerender("enableError", { errorHidden: false });
  return error;
}

export function _toggleError (component: UIComponent) {
  component.flushAndRerender("toggleError", { errorHidden: !component.state.errorHidden });
}

export function _clearError (component: UIComponent) {
  component._stickyErrorObject = null;
  component.flushAndRerender("clearError", { errorHidden: false });
}
