// @flow
import UIComponent from "~/inspire/ui/UIComponent";
import type { LiveUpdate } from "~/engine/Vrapper";
import VALEK from "~/engine/VALEK";

import { dumpObject, thenChainEagerly, wrapError } from "~/tools";

const toTextPlainInterpretation =
    VALEK.if(VALEK.toMediaContentField(), {
      then: VALEK.interpretContent({ contentType: "text/plain" }),
    });

export default class MediaContentEditor extends UIComponent {
  bindFocusSubscriptions (focus: any, props: Object) {
    super.bindFocusSubscriptions(focus, props);
    const editor = this;
    return thenChainEagerly(null, [
      this.bindLiveKuery.bind(this, `FileEditor_content`,
          focus, toTextPlainInterpretation,
          { asRepeathenable: true, scope: this.getUIContext() }),
      function _getUpdateValue (liveUpdate: LiveUpdate) {
        return liveUpdate.value();
      },
      function _setEditorStateContent (content) {
        editor.setState({ content });
        return false; // prevent force-update
      },
    ], function errorOnMediaContentEditorSubscriptions (error) {
      throw wrapError(error,
          new Error(`During ${editor.debugId()
              }\n .bindFocusSubscriptions.FileEditor_content(), with:`),
          "\n\tfocus:", ...dumpObject(focus),
          "\n\tprops:", ...dumpObject(props),
          "\n\tmediaEditor:", ...dumpObject(editor));
    });
  }
}
