const { ref } = require("@valos/revdoc/extractee");

const defineName = require("@valos/engine/valosheath/defineName");

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

Object.defineProperty(module.exports, "__esModule", { value: true });
module.exports.default = _createSymbols();

function _createSymbols () {
  const ret = module.exports.symbols;
  function _defineName (name, createNameParameters) {
    return defineName(name, module.exports, createNameParameters);
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
