// @flow
import React from "react";
import VALEK from "~/engine/VALEK";
import UIComponent from "~/inspire/ui/UIComponent";

import TextFileEditor from "~/inspire/ui/TextFileEditor";

import { mediaTypeFromFilename } from "~/tools/MediaTypeData";

export default class MediaEditor extends UIComponent {
  preRenderFocus (focus: any) {
    const mediaType = focus.step(
            VALEK.to("mediaType").nullable().select(["type", "subtype", "contentType"]))
        || mediaTypeFromFilename(focus.step("name"));
    if (!mediaType) return <p>Cannot determine media type for file {`'${focus.step("name")}'`}</p>;
    if (!_isTextMediaType(mediaType)) {
      return (
        <p>
          Non-text/unrecognized media type &quot;{mediaType.contentType}&quot;
          for file {`'${focus.step("name")}'`}
        </p>
      );
    }
    return (
      <div style={{ width: "100%", height: "100%" }}>
        <TextFileEditor {...this.childProps("textFileEditor", {})} />
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
