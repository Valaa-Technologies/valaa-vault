module.exports = {
  prefix: "revdoc",
  base: "https://valospace.org/kernel/revdoc#",

  prefixes: {
    revdoc: "https://valospace.org/kernel/revdoc#",
  },
  context: {
  },
  vocabulary: {
    Document: { a: "rdfs:Class", "rdfs:subClassOf": "vdoc:Chapter",
      "rdfs:comment": "A ReSpec specification document",
    },
    Definition: { a: "rdfs:Class", "rdfs:subClassOf": "vdoc:Node",
      "rdfs:comment": "A ReSpec term definition document node",
    },
    Package: { a: "rdfs:Class", "rdfs:subClassOf": "vdoc:Reference",
      "rdfs:comment": "A package reference document node",
    },
    Command: { a: "rdfs:Class", "rdfs:subClassOf": "vdoc:Node",
      "rdfs:comment": "A command invokation document node",
    },
    CommandLineInteraction: { a: "rdfs:Class", "rdfs:subClassOf": "vdoc:Node",
      "rdfs:comment": "A command line interaction sequence document node",
    },
  },
  extractionRules: {
    ontology: {
      range: "vdoc:Chapter", target: "vdoc:content", rest: "dc:title",
      comment: "Ontology specification chapter",
    },
  },
};
