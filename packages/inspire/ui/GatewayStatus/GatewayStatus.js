// @flow
import React from "react";

import { unthunkRepeat } from "~/inspire/ui/thunk";
import UIComponent from "~/inspire/ui/UIComponent";

import { beaumpify } from "~/tools";

export default class GatewayStatus extends UIComponent {
  static _defaultPresentation = () => unthunkRepeat(require("./presentation").default);
  bindFocusSubscriptions (focus: any, props: Object) {
    super.bindFocusSubscriptions(focus, props);
    const inspireGateway = this.getValos().gateway;
    if (inspireGateway) {
      inspireGateway.setCommandCountListener(this,
          (totalCommandCount: number, chronicleCommandCounts: Object) =>
              this.setState({ totalCommandCount, chronicleCommandCounts }));
    }
  }

  unbindSubscriptions () {
    const inspireGateway = this.getValos().gateway;
    if (inspireGateway) inspireGateway.setCommandCountListener(this);
    super.unbindSubscriptions();
  }

  preRenderFocus () {
    return (
      <div {...this.presentation("root")}>
        <span // eslint-disable-line jsx-a11y/click-events-have-key-events
          {...this.presentation("totalCommandCount", { extraContext: this.state })}
          onClick={this.props.toggle}
        >
          {this.state.totalCommandCount}
        </span>
        {this.props.show && <div>{beaumpify(this.state.chronicleCommandCounts)}</div>}
      </div>
    );
  }
}
