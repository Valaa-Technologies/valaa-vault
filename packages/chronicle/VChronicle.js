module.exports = {
  domain: "@valos/kernel",
  preferredPrefix: "VChronicle",
  baseIRI: "https://valospace.org/chronicle/0#",
  namespaceModules: {
    VKernel: "@valos/kernel/VKernel",
    V: "@valos/space/V",
  },
  description: "The valospace vocabulary for specifying chronicle behaviors",
  context: {},
  vocabulary: {
    // behaviors
    requireAuthoredEvents: {
      "@type": "VKernel:Property",
      "rdfs:domain": "V:Resource",
      "rdfs:range": "xsd:boolean", // TODO(iridian, 2020-10): Add user role semantics
      "rdfs:comment":
`When set all chronicle events must be authored with an AuthorAspect.`,
    },

    // contributors
    contributor: {
      "@type": "VKernel:Property",
      "rdfs:domain": "V:Resource",
      "rdfs:range": "V:Resource", // TODO(iridian, 2020-10): Add user role semantics
      "rdfs:comment":
`The collection of roles which have registered certificates for signing
events to this chronicle event log.`,
    },
    director: {
      "@type": "VKernel:Property",
      "rdfs:subPropertyOf": "VLog:contributor",
      "rdfs:domain": "V:Resource",
      "rdfs:range": "V:Resource", // TODO(iridian, 2020-10): Add user role semantics
      "rdfs:comment":
`The collection of roles which and only which can make changes to the
chronicle behaviors (eg. permissions).`,
    },
  },
};
