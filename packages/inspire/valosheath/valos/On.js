// @flow

import { defineName } from "~/engine/valosheath";

export const namespace = {
  preferredPrefix: "On",
  baseIRI: "https://valospace.org/inspire/On/0#",
  description:
`The ValOS inspire On namespace contains event callback names used by
the inspire UI layer.

The namespace inherits all HTML5 event names verbatim as name suffixes
but also adds new valos-specific event callback names. Like HTML5
events these callbacks are called with a synthetic event as their first
argument.
`,
  nameSymbols: {},
  nameDefinitions: {},
};

export default _createSymbols();

function _createSymbols () {
  const ret = namespace.nameSymbols;

  function _defineName (name: string, createNameParameters: Object) {
    return defineName(name, namespace, createNameParameters);
  }

  _defineName("frameactive", () => ({
    tags: ["Attribute", "Event"],
    type: "EventHandler",
    description:
`The ValOS frame of the element is active`,
  }));

  _defineName("framepropertychange", () => ({
    tags: ["Attribute", "Event"],
    type: "EventHandler",
    description: `A ValOS frame property has changed`,
  }));

  _defineName("focuspropertychange", () => ({
    tags: ["Attribute", "Event"],
    type: "EventHandler",
    description: `A ValOS focus property has changed`,
  }));

  return ret;
}
