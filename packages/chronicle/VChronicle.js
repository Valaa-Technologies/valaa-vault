module.exports = {
  domain: "@valos/kernel",
  preferredPrefix: "VChronicle",
  baseIRI: "https://valospace.org/chronicle/0#",
  namespaceModules: {
    VKernel: "@valos/kernel/VKernel",
    VState: "@valos/state/VState",
    VLog: "@valos/log/VLog",
    V: "@valos/space/V",
  },
  description:
`The valospace vocabulary for specifying behaviors on specific chronicles`,
  context: {},
  vocabulary: {
    // behaviors
    requiresAuthoredEvents: {
      "@type": "VKernel:Property",
      "rdfs:domain": "V:Resource",
      "rdfs:range": "xsd:boolean", // TODO(iridian, 2020-10): Add user role semantics
      "rdfs:comment":
`When set to true all the chronicle events must be authored with
an AuthorAspect.`,
    },
    // contributors
    hasContributor: {
      "@type": "VKernel:Property",
      "rdfs:domain": "V:Resource",
      "rdfs:range": "V:Resource", // TODO(iridian, 2020-10): Add user role semantics
      "rdfs:comment":
`The collection of identities which have registered their signature
public keys to the chronicle event log.`,
    },
    hasDirector: {
      "@type": "VKernel:Property",
      "rdfs:subPropertyOf": "VChronicle:hasContributor",
      "rdfs:domain": "V:Resource",
      "rdfs:range": "V:Resource", // TODO(iridian, 2020-10): Add user role semantics
      "rdfs:comment":
`The collection of identities which (and only which) can make changes
to the chronicle behaviors (eg. permissions).`,
    },
  },
};
