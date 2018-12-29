// @flow
import React from "react";

import Presentable from "~/inspire/ui/Presentable";
import UIComponent from "~/inspire/ui/UIComponent";

import { beaumpify } from "~/tools";

export default @Presentable(require("./presentation").default, "InspireGatewayStatus")
class InspireGatewayStatus extends UIComponent {
  attachSubscribers (focus: any, props: Object) {
    super.attachSubscribers(focus, props);
    const inspireGateway = this.getValaa().gateway;
    if (inspireGateway) {
      inspireGateway.setCommandCountListener(this,
          (totalCommandCount: number, partitionCommandCounts: Object) =>
              this.setState({ totalCommandCount, partitionCommandCounts }));
    }
  }

  detachSubscribers () {
    const inspireGateway = this.getValaa().gateway;
    if (inspireGateway) inspireGateway.setCommandCountListener(this);
    super.detachSubscribers();
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
        {this.props.show && <div>{beaumpify(this.state.partitionCommandCounts)}</div>}
      </div>
    );
  }
}
