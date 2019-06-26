const vdoc = require("@valos/toolset-vault/vdoc");
const ontology = require("./ontology");

module.exports = {
  ...vdoc,
  dfn,
  editors,
  ontology,
  ontologyTables: {
    prefixes: {
      "column#0;vdoc:key": "Prefix",
      "column#1;vdoc:value": "IRI",
    },
    context: {
      "column#0;vdoc:key": "Term",
      "column#1;vdoc:value": "Definition",
    },
    vocabulary: {
      "column#0;vdoc:key": "rdfs:label",
      "column#1;a": "rdf:type",
      "column#2;rdf:subClassOf": "rdf:subClassOf",
      "column#3;rdf:domain": "rdf:domain",
      "column#4;rdf:range": "rdf:range",
      "column#5;rdfs:comment": "rdfs:comment",
    },
    extractionRules: {
      "column#0;vdoc:key": "Rule name",
      "column#1;range": "Node rdf:type",
      "column#2;extraction": "Extraction property",
      "column#3;comment": "Comment",
    },
  },
  extract: function extract (documentIRI, sourceGraphs,
      ontologies = [ontology, vdoc.ontology]) {
    return vdoc.extract(documentIRI, sourceGraphs, ontologies);
  },
  emit: function emit (emission, vdocson, formatName,
      ontologies = [ontology, vdoc.ontology]) {
    return vdoc.emit(emission, vdocson, formatName, ontologies);
  },
};

function dfn (text, definitionId, ...explanation) {
  return {
    "revdoc:dfn": definitionId,
    "vdoc:content": [vdoc.ref(text, definitionId, "bold"), ...explanation],
  };
}

function editors (...editorNames) {
  const editorsPath = `${process.cwd()}/toolsets.json`;
  const editorLookup = ((require(editorsPath)["@valos/toolset-vault"] || {})
      .revdoc || {}).editors || {};
  return (editorNames || []).map(editorName => {
    const editor = editorLookup[editorName];
    if (!editor) {
      throw new Error(`Cannot find editor '${editorName}' from toolsetConfig("${
        editorsPath}")["@valos/toolset-vault"].revdoc.editors`);
    }
    return editor;
  });
}
