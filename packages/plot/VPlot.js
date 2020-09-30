module.exports = {
  domain: "@valos/kernel",
  preferredPrefix: "VPlot",
  baseIRI: "https://valospace.org/plot/0#",
  namespaceModules: {
    VKernel: "@valos/kernel/VKernel",
    VState: "@valos/state/VState",
    VLog: "@valos/log/VLog",
    VValk: "@valos/valk/VValk",
  },
  description:
`The vocabulary for defining the hierarchical ValOS identifiers and for
extending them with new step semantics`,
  context: {},
  vocabulary: {
    VPlotLiteral: {
      "@type": "VKernel:Class",
      "rdfs:subClassOf": ["rdfs:Literal", "rdfs:List"],
      "VRevdoc:brief": "VPlot 'vrid' literal datatype",
      "rdfs:comment":
`The class of all literals which can be represented as some VPlot rule
or pseudo-rule.
If this class is used as literal datatype URI the literal contains the
flat string VPlot rule representation. Otherwise when this class is
the range of a property which is used as a predicate in a triple, and
the object of the triple is not a literal, then the object contains
the segmented representation of the VPlot rule value as an rdf List.`
    },
    VPlot: { "@type": "VKernel:Class",
      "rdfs:subClassOf": "VPlot:VPlotLiteral",
      "VRevdoc:brief": "VPlot rule 'vplot' datatype",
      "rdfs:comment":
`The class of all resources that can be represented by the VPlot rule
'vplot' (the string representation always begins with '@')`,
    },
    VRID: { "@type": "VKernel:Class",
      "rdfs:subClassOf": "VPlot:VPlotLiteral",
      "VRevdoc:brief": "VPlot rule 'vrid' datatype",
      "rdfs:comment":
`The class of all resources that can be represented by the VPlot
pseudo-rule 'vrid', ie. which have have a 'vgrid' as their first step
(the string representation always begins with '@')`,
    },
    Verbs: { "@type": "VKernel:Class",
      "rdfs:subClassOf": "VPlot:VPlotLiteral",
      "VRevdoc:brief": "VPlot rule 'verbs' datatype",
      "rdfs:comment":
`The class of all resources that can be represented by the VPlot
pseudo-rule 'verbs', ie. which represent a path between resources ie.
which don't have a 'vgrid' as their first step (the string
representation always begins with '@').`,
    },
    Verb: { "@type": "VKernel:Class",
      "rdfs:subClassOf": "VPlot:VPlotLiteral",
      "VRevdoc:brief": "verb name type",
      "rdfs:comment":
`The class of all verb names. A context that performs VPlot valks shall
provide the conforming implementations for the subset of verbs that it
has declared to support.`,
    },
    VGRID: { "@type": "VKernel:Class",
      "rdfs:subClassOf": "VPlot:VPlotLiteral",
      "VRevdoc:brief": "VPlot rule 'vgrid' datatype",
      "rdfs:comment":
`The class of all resources representing the VPlot rule 'vgrid' (always
begins with '$').`,
    },
    VParam: { "@type": "VKernel:Class",
      "rdfs:subClassOf": "VPlot:VPlotLiteral",
      "VRevdoc:brief": "VPlot rule 'vparam' datatype",
      "rdfs:comment":
`The class of all resources representing the VPlot pseudo-rule
'vparam' (always begins with '$' or ':').`,
    },
  },
};
