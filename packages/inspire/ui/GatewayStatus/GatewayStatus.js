// @flow
import React from "react";

import UIComponent from "~/inspire/ui/UIComponent";

import { beaumpify } from "~/tools";

export default class GatewayStatus extends UIComponent {
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
      <div style={{ position: "fixed", left: "120px", top: "0px", zIndex: 10000 }}>
        <span // eslint-disable-line jsx-a11y/click-events-have-key-events
          style={{
            fontSize: (this.state.totalCommandCount <= 1
                ? "40px" : `${80 + this.state.totalCommandCount}px`),
            color: (this.state.totalCommandCount === 0
                ? "green" : this.state.totalCommandCount === 1 ? "yellow" : "red")
          }}
          onClick={this.props.toggle}
        >
          {this.state.totalCommandCount}
        </span>
        {this.props.show && <div>{beaumpify(this.state.chronicleCommandCounts)}</div>}
      </div>
    );
  }
}
