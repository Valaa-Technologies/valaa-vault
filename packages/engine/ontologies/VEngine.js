module.exports = {
  "@context": {
    VKernel: "https://valospace.org/kernel/0#",
    VModel: "https://valospace.org/raem/0#",
    restriction: { "@reverse": "owl:onProperty" },
  },
  ontology: { "@type": "owl:Ontology",
    "rdfs:label": "VEngine",
    "rdf:about": "https://valospace.org/engine/0#",
    "rdfs:comment":
`VEngine ontology provides vocabulary for describing and defining
the valosheath and its types, objects, properties, methods and constants.`,
  },
  Property: { "@type": "VKernel:Class",
    "rdfs:subClassOf": "rdf:Property",
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
    "rdfs:domain": "VModel:Type",
    "rdfs:range": "VModel:Field",
    "rdfs:comment":
`The VModel:Field resources with this VModel:Type as their domain.`,
  },
  domainOfProperty: {
    "@type": "VKernel:Property",
    "rdfs:domain": "rdfs:Class",
    "rdfs:range": "VKernel:Property",
    "rdfs:comment":
`The VKernel:Property resources with this rdfs:Class as their domain.`,
  },
  domainOfMethod: {
    "@type": "VKernel:Property",
    "rdfs:domain": "rdfs:Class",
    "rdfs:range": "VKernel:Method",
    "rdfs:comment":
`The VKernel:Method resources with this rdfs:Class as their domain.`,
  },
  hasProperty: {
    "@type": "VKernel:Property",
    "rdfs:domain": "rdfs:Class",
    "rdfs:range": "VKernel:ObjectProperty",
    "rdfs:comment":
`The VKernel:ObjectProperty resources with this rdfs:Class as their domain.`,
  },
  hasMethod: {
    "@type": "VKernel:Property",
    "rdfs:domain": "rdfs:Class",
    "rdfs:range": "VKernel:ObjectMethod",
    "rdfs:comment":
`The VKernel:ObjectMethod resources with this rdfs:Class as their domain.`,
  },
};
