module.exports = {
  domain: "@valos/kernel",
  preferredPrefix: "VChronicle",
  baseIRI: "https://valospace.org/chronicle/0#",
  prefixes: {
    acl: "http://www.w3.org/ns/auth/acl#",
    vcard: "http://www.w3.org/2006/vcard/ns#",
  },
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
      "@type": "VKernel:Class",
      "rdfs:domain": "V:Resource",
      "rdfs:range": "xsd:boolean", // TODO(iridian, 2020-10): Add user role semantics
      "rdfs:comment":
`When set to true all the chronicle events must be authored with
an AuthorAspect.`,
    },
    // contributors
    Contributorship: {
      "@type": "V:Relation",
      "rdfs:subClassOf": "acl:Authorization",
      // TODO(iridian, 2020-02): Add inference denotation for:
      // Contributorship V:source to be same as acl:accessTo
      // Contributorship V:target to be same as acl:agent
      "rdfs:comment":
`The collection of agents which have registered their signature public
keys to the chronicle event log.`,
    },
    Directorship: {
      "@type": "V:Relation",
      "rdfs:subClassOf": "VChronicle:Contributorship",
      "rdfs:comment":
`The collection of identities which (and only which) can make changes
to the chronicle behaviors (eg. permissions).`,
    },
  },
};
