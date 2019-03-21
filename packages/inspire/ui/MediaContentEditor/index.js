// @flow
import UIComponent from "~/inspire/ui/UIComponent";
import Presentable from "~/inspire/ui/Presentable";
import { LiveUpdate } from "~/engine/Vrapper";
import VALEK from "~/engine/VALEK";

import { wrapError } from "~/tools/wrapError";

const toTextPlainInterpretation =
    VALEK.if(VALEK.toMediaContentField(), { then: VALEK.interpretContent({ mime: "text/plain" }) });

export default @Presentable(require("./presentation").default, "MediaContentEditor")
class MediaContentEditor extends UIComponent {
  bindSubscriptions (focus: any, props: Object) {
    try {
      super.bindSubscriptions(focus, props);
      this.bindNewKuerySubscription(`FileEditor_content`,
          focus, toTextPlainInterpretation, { scope: this.getUIContext() },
          this.onContentUpdate);
    } catch (error) {
      throw wrapError(error, `During ${this.debugId()}\n .bindSubscriptions(), with:`,
          "\n\thead:       ", focus,
          "\n\tthis:       ", this);
    }
  }

  onContentUpdate = async (liveUpdate: LiveUpdate) => {
    this.setState({ content: await liveUpdate.value() });
  }
}
