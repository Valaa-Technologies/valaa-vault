const { ref } = require("@valos/revdoc/extractee");
const { buildNamespaceSpecification } = require("@valos/tools/namespace");

module.exports = buildNamespaceSpecification({
  base: require("@valos/sourcerer/On"),
  extenderModule: "@valos/inspire/On",
  namespaceModules: {
    VKernel: "@valos/kernel/VKernel",
    V: "@valos/space/V",
    VEngine: "@valos/engine/VEngine",
    Lens: "@valos/inspire/Lens",
  },
  declareNames,
  processDeclaration (name, declaration, { domain, addLabel }) {
    const componentType = declaration.tags.includes("Valoscope") ? "Lens:Valoscope"
        : declaration.tags.includes("Attribute") ? "Lens:Element"
        : null;
    if (componentType) {
      domain.push(componentType);
      addLabel(`On:${name}`, `On:${name}`, [`When used as `, ref(componentType), " attribute"]);
    }
  },
});

function declareNames ({ declareName }) {
  declareName("click", {
    tags: ["Attribute", "HTML5", "Event"],
    type: "EventHandler",
    description:
ref("The HTML5 'click' event", "https://w3c.github.io/uievents/#event-type-click"),
  });

  declareName("frameactive", {
    tags: ["Attribute", "Inspire", "Event"],
    type: "EventHandler",
    description:
`The ValOS frame of the element is active`,
  });

  declareName("framepropertychange", {
    tags: ["Attribute", "Inspire", "Event"],
    type: "EventHandler",
    description:
`A ValOS frame property has changed`,
  });

  declareName("focuspropertychange", {
    tags: ["Attribute", "Inspire", "Event"],
    type: "EventHandler",
    description:
`A ValOS focus property has changed`,
  });
}
