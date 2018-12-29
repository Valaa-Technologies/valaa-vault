// @flow
import PropTypes from "prop-types";
import UIComponent from "~/inspire/ui/UIComponent";

export default class If extends UIComponent {
  static propTypes = {
    ...UIComponent.propTypes,
    test: PropTypes.any,
  };

  renderLoaded (focus: Object) {
    if (!this.props.test) return null;
    return super.renderLoaded(focus);
  }
}
