// @flow
import React from "react";
import VALEK from "~/engine/VALEK";
import Presentable from "~/inspire/ui/Presentable";
import UIComponent from "~/inspire/ui/UIComponent";

import TextFileEditor from "~/inspire/ui/TextFileEditor";

import { mediaTypeFromFilename } from "~/tools/MediaTypeData";

export default @Presentable(require("./presentation").default, "MediaEditor")
class MediaEditor extends UIComponent {
  preRenderFocus (focus: any) {
    const mediaType = focus.get(
            VALEK.to("mediaType").nullable().select(["type", "subtype", "contentType"]))
        || mediaTypeFromFilename(focus.get("name"));
    if (!mediaType) return <p>Cannot determine media type for file {`'${focus.get("name")}'`}</p>;
    if (!_isTextMediaType(mediaType)) {
      return (
        <p>
          Non-text/unrecognized media type &quot;{mediaType.contentType}&quot;
          for file {`'${focus.get("name")}'`}
        </p>
      );
    }
    return (
      <div {...this.presentation("root")}>
        <TextFileEditor {...this.childProps("textFileEditor")} />
      </div>
    );
  }
}

function _isTextMediaType ({ type, subtype }: Object) {
  if (type === "text") return true;
  if ((type === "application") && (subtype.slice(-6) === "script")) return true;
  if ((type === "application") && (subtype === "xml")) return true;
  if ((type === "application") && (subtype === "json")) return true;
  return false;
}
