// @flow
import PropTypes from "prop-types";

import UIComponent from "~/inspire/ui/UIComponent";
import Presentable from "~/inspire/ui/Presentable";
import { LiveUpdate } from "~/engine/Vrapper";
import VALEK from "~/engine/VALEK";

import { wrapError } from "~/tools/wrapError";

export default @Presentable(require("./presentation").default, "FieldEditor")
class FieldEditor extends UIComponent {
  static propTypes = {
    ...UIComponent.propTypes,
    fieldName: PropTypes.string
  };

  bindSubscriptions (focus: any, props: Object) {
    try {
      super.bindSubscriptions(focus, props);
      this.bindNewKuerySubscription(`FieldEditor_${props.fieldName}`,
          focus, VALEK.to(props.fieldName).nullable(), { scope: this.getUIContext() },
          this.onValueUpdate,
      );
    } catch (error) {
      throw wrapError(error, `During ${this.debugId()}\n .bindSubscriptions(), with:`,
          "\n\thead:       ", focus,
          "\n\tthis:       ", this);
    }
  }

  onValueUpdate = (liveUpdate: LiveUpdate) => {
    this.setState({ value: liveUpdate.value() });
  }
}
