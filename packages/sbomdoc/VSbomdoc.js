module.exports = {
  domain: "@valos/kernel",
  preferredPrefix: "VSbomdoc",
  baseIRI: "https://valospace.org/sbomdoc/0#",
  namespaceModules: {
    VKernel: "@valos/kernel/VKernel",
    VDoc: "@valos/vdoc/VDoc",
    VRevdoc: "@valos/revdoc/VRevdoc",
    VSbomdoc: "@valos/sbomdoc/VSbomdoc",
  },
  description:
`'VSbomdoc' namespace provides vocabulary and definitions which are
tailored for representing CycloneDX SBoM analysis semantic content.`,
  context: {
    restriction: { "@reverse": "owl:onProperty" },
  },
  vocabulary: {
    Document: { "@type": "rdfs:class", "rdfs:subClassOf": "VDoc:Chapter",
      "rdfs:comment": "A Software Bill of Materials document",
    },
  },
};
