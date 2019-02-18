// @flow
import UIComponent from "~/inspire/ui/UIComponent";
import Presentable from "~/inspire/ui/Presentable";
import FieldUpdate from "~/engine/Vrapper/FieldUpdate";
import VALEK from "~/engine/VALEK";

import { wrapError } from "~/tools/wrapError";

export default @Presentable(require("./presentation").default, "MediaContentEditor")
class MediaContentEditor extends UIComponent {
  attachSubscribers (focus: any, props: Object) {
    try {
      super.attachSubscribers(focus, props);
      this.attachKuerySubscriber(`FileEditor.content`, focus,
          VALEK.if(VALEK.toMediaContentField(),
              { then: VALEK.interpretContent({ mime: "text/plain" }) }),
              { onUpdate: this.onContentUpdate, scope: this.getUIContext() });
    } catch (error) {
      throw wrapError(error, `During ${this.debugId()}\n .attachSubscribers(), with:`,
          "\n\thead:       ", focus,
          "\n\tthis:       ", this);
    }
  }

  onContentUpdate = async (update: FieldUpdate) => {
    this.setState({ content: await update.value() });
  }
}
