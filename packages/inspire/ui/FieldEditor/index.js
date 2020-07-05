// @flow
import PropTypes from "prop-types";

import UIComponent from "~/inspire/ui/UIComponent";
import type LiveUpdate from "~/engine/Vrapper/LiveUpdate";
import VALEK from "~/engine/VALEK";

import { dumpObject, thenChainEagerly, wrapError } from "~/tools";

export default class FieldEditor extends UIComponent {
  static propTypes = {
    ...UIComponent.propTypes,
    fieldName: PropTypes.string
  };

  bindFocusSubscriptions (focus: any, props: Object) {
    super.bindFocusSubscriptions(focus, props);
    const fieldEditor = this;
    return thenChainEagerly(null, [
      this.bindLiveKuery.bind(this, `FieldEditor_${props.fieldName}`,
          focus, VALEK.to(props.fieldName).nullable(),
          { asRepeathenable: true, scope: this.getUIContext() }),
      function updateFieldEditorValue (liveUpdate: LiveUpdate) {
        fieldEditor.setState({ value: liveUpdate.value() });
        return false; // don't force-update
      },
    ], function errorOnFieldEditorSubscription (error) {
      throw wrapError(error, `During ${
          fieldEditor.debugId()}\n .bindFocusSubscriptions.FieldEditor_${props.fieldName}, with:`,
          "\n\tfocus:", ...dumpObject(focus),
          "\n\tprops:", ...dumpObject(props),
          "\n\tthis:", ...dumpObject(fieldEditor),
      );
    });
  }
}
