module.exports = {
  domain: "@valos/kernel",
  preferredPrefix: "VEngine",
  baseIRI: "https://valospace.org/engine/0#",
  namespaceModules: {
    VKernel: "@valos/kernel/VKernel",
    VValk: "@valos/valk/VValk",
    VState: "@valos/state/VState",
    VEngine: "@valos/engine/VEngine",
  },
description:
`'VEngine' namespace provides vocabulary for describing and defining
the valosheath and its types, objects, properties, methods and constants.`,
  context: {
    restriction: {
      "@reverse": "owl:onProperty",
    },
  },
  vocabulary: {
    valosheath: { "@type": "VKernel:API",
      "VRevdoc:brief": "valos fabric API",
      "rdfs:comment": [
`The API for accessing valos fabric from valospace.`,
`Contains the vocabulary with which valoscript code can access
non-valospace resources, notably including the services of the current
execution environment.`,
      ],
    },
    Class: { "@type": "VKernel:Class",
      "rdfs:subClassOf": "VKernel:Class",
      "VRevdoc:brief": "valosheath type prototype property",
      "rdfs:comment":
`The class of all valosheath type prototype properties.`,
    },
    Property: { "@type": "VKernel:Class",
      "rdfs:subClassOf": "VKernel:Property",
      "VRevdoc:brief": "valosheath type prototype property",
      "rdfs:comment":
`The class of all valosheath type prototype properties.`,
    },
    Method: { "@type": "VKernel:Class",
      "rdfs:subClassOf": "VKernel:Property",
      "VRevdoc:brief": "valosheath type prototype method",
      "rdfs:comment":
`The class of all valosheath type prototype methods.`,
    },
    Global: { "@type": "VKernel:Class",
      "rdfs:subClassOf": "rdfs:Resource",
      "VRevdoc:brief": "valosheath global resource",
      "rdfs:comment":
`The class of all valosheath global resources.`,
    },
    ObjectProperty: { "@type": "VKernel:Class",
      "rdfs:subClassOf": "rdf:Property",
      "VRevdoc:brief": "valosheath object property",
      "rdfs:comment":
`The class of all valosheath object properties.`,
    },
    ObjectMethod: { "@type": "VKernel:Class",
      "rdfs:subClassOf": "rdf:Property",
      "VRevdoc:brief": "valosheath object method",
      "rdfs:comment":
`The class of all valosheath object methods.`,
    },
    domainOfField: {
      "@type": "VKernel:Property",
      "rdfs:domain": "VState:Type",
      "rdfs:range": "VState:Field",
      "rdfs:comment":
`The VState:Field individuals which have this VState:Type as their rdfs:domain.`,
    },
    domainOfProperty: {
      "@type": "VKernel:Property",
      "rdfs:domain": "rdfs:Class",
      "rdfs:range": "VKernel:Property",
      "rdfs:comment":
`The VKernel:Property individuals which have this rdfs:Class as their rdfs:domain.`,
    },
    domainOfMethod: {
      "@type": "VKernel:Property",
      "rdfs:domain": "rdfs:Class",
      "rdfs:range": "VEngine:Method",
      "rdfs:comment":
`The VEngine:Method individuals which have this rdfs:Class as their rdfs:domain.`,
    },
    hasProperty: {
      "@type": "VKernel:Property",
      "rdfs:domain": "rdfs:Class",
      "rdfs:range": "VEngine:ObjectProperty",
      "rdfs:comment":
`The VEngine:ObjectProperty individuals which have this rdfs:Class as their rdfs:domain.`,
    },
    hasMethod: {
      "@type": "VKernel:Property",
      "rdfs:domain": "rdfs:Class",
      "rdfs:range": "VEngine:ObjectMethod",
      "rdfs:comment":
`The VEngine:ObjectMethod individuals which have this rdfs:Class as their rdfs:domain.`,
    },
  },
};
