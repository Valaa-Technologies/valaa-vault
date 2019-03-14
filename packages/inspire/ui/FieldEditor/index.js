// @flow
import PropTypes from "prop-types";

import UIComponent from "~/inspire/ui/UIComponent";
import Presentable from "~/inspire/ui/Presentable";
import FieldUpdate from "~/engine/Vrapper/FieldUpdate";
import VALEK from "~/engine/VALEK";

import { wrapError } from "~/tools/wrapError";

export default @Presentable(require("./presentation").default, "FieldEditor")
class FieldEditor extends UIComponent {
  static propTypes = {
    ...UIComponent.propTypes,
    fieldName: PropTypes.string
  };

  attachSubscribers (focus: any, props: Object) {
    try {
      super.attachSubscribers(focus, props);
      this.subscribeToKuery(`FieldEditor["${props.fieldName}"]`, focus,
          VALEK.to(props.fieldName).nullable(), {
            onUpdate: this.onValueUpdate,
            scope: this.getUIContext(),
          });
    } catch (error) {
      throw wrapError(error, `During ${this.debugId()}\n .attachSubscribers(), with:`,
          "\n\thead:       ", focus,
          "\n\tthis:       ", this);
    }
  }

  onValueUpdate = (update: FieldUpdate) => {
    this.setState({ value: update.value() });
  }
}
