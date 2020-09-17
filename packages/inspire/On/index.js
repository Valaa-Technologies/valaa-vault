const { ref } = require("@valos/revdoc/extractee");

const defineName = require("@valos/engine/valosheath/defineName");
const resolveNamespaceDefinitions = require("@valos/engine/valosheath/resolveNamespaceDefinitions");

module.exports = {
  domain: "@valos/kernel",
  preferredPrefix: "On",
  baseIRI: "https://valospace.org/inspire/On/0#",
  namespaceModules: {
    VKernel: "@valos/kernel/VKernel",
    V: "@valos/kernel/V",
    VEngine: "@valos/engine/VEngine",
    Lens: "@valos/inspire/Lens",
    On: "@valos/inspire/On",
  },
  description: [
`The ValOS inspire On namespace contains event callback names used by
the inspire UI layer.`,
null,
`The namespace inherits all HTML5 event names verbatim as name suffixes
but also adds new valos-specific event callback names. Like HTML5
events these callbacks are called with a synthetic event as their first
argument.`,
  ],
  definitions: {},
  symbols: {},
  processTags (tags, definitionDomain) {
    const labels = [];
    const componentType = tags.includes("Valoscope") ? "Lens:Valoscope"
        : tags.includes("Attribute") ? "Lens:Element"
        : null;
    if (componentType) {
      definitionDomain.push(componentType);
      labels.push([`On:${name}`, `On:${name}`]);
    }
    return labels;
  },
};

_createSymbols();
resolveNamespaceDefinitions(module.exports);

function _createSymbols () {
  const ret = module.exports.symbols;
  function _defineName (name, createNameParameters) {
    return defineName(name, module.exports, createNameParameters);
  }
  _defineName("frameactive", () => ({
    tags: ["Attribute", "Inspire", "Event"],
    type: "EventHandler",
    description:
`The ValOS frame of the element is active`,
  }));

  _defineName("framepropertychange", () => ({
    tags: ["Attribute", "Inspire", "Event"],
    type: "EventHandler",
    description:
`A ValOS frame property has changed`,
  }));

  _defineName("focuspropertychange", () => ({
    tags: ["Attribute", "Inspire", "Event"],
    type: "EventHandler",
    description:
`A ValOS focus property has changed`,
  }));

  _defineName("click", () => ({
    tags: ["Attribute", "HTML5", "Event"],
    type: "EventHandler",
    description:
ref("The HTML5 'click' event", "https://w3c.github.io/uievents/#event-type-click"),
  }));
  return ret;
}
