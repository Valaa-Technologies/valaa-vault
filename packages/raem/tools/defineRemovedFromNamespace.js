const { extendNamespace } = require("@valos/revdoc");

module.exports = {
  defineRemovedFromNamespace (preferredPrefix, baseIRI, sourceOntology) {
    const vocabulary = {};
    Object.entries((sourceOntology || {}).vocabulary || {}).forEach(([key, definition]) => {
      if (definition["rdfs:range"] === "rdfs:List"
          && ((definition["@type"] === "VState:EventLoggedField")
              || (definition["@type"] === "VState:CoupledField"))) {
        vocabulary[key] = {
          "@type": "VState:GeneratedField",
          "rdfs:domain": definition["rdfs:domain"],
          "rdfs:range": "rdfs:List",
          "rdfs:comment": `removed-from entries of field ${sourceOntology.preferredPrefix}:${key}.`,
        };
      }
    });
    return extendNamespace({
      base: {
        preferredPrefix,
        baseIRI,
      },
      description:
`'${preferredPrefix}' removed-from namespace provides vocabulary and
definitions for valospace resource removed-from fields.`,
      namespaceModules: {
        VKernel: "@valos/kernel/VKernel",
      },
      context: {
        ...(sourceOntology || {}).prefixes,
        restriction: { "@reverse": "owl:onProperty" },
      },
      vocabulary,
    });
  },
};
