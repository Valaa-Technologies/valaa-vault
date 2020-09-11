// @flow

import { defineName, buildOntologyNamespace } from "~/engine/valosheath";

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

export const ontology = buildOntologyNamespace(namespace, (tags, definitionDomain) => {
      const labels = [];
      const componentType = tags.includes("Valoscope") ? "Lens:Valoscope"
          : tags.includes("Attribute") ? "Lens:Element"
          : null;
      if (componentType) {
        definitionDomain.push(componentType);
        labels.push([`On:${name}`, `On:${name}`]);
      }
      if (tags.includes("Context")) {
        definitionDomain.push("Lens:UIContext");
        labels.push([`context[$On.${name}]`, `$On.${name}`]);
      }
      if (!componentType && tags.includes("On")) {
        labels.push([`On:${name}`]);
      }
      return labels;
    }, {
      "@context": {
        V: "https://valospace.org/0#",
        VKernel: "https://valospace.org/kernel/0#",
        VEngine: "https://valospace.org/engine/0#",
        Lens: "https://valospace.org/inspire/Lens/0#",
        restriction: { "@reverse": "owl:onProperty" },
      },
    });

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
