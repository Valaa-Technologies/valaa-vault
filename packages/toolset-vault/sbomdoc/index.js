const vdoc = require("@valos/toolset-vault/vdoc");

const ontology = require("./ontology");

module.exports = {
  ...vdoc,
  ontology,
  ontologyTables: {
    components: {
      "column#0;name": "Name",
      "column#1;group": "Group",
      "column#2;type": "Type",
      "column#3;version": "Version",
      "column#4;modified": "Modified",
      "column#5;licenses": "Licenses",
      "column#6;purl": "PURL",
      "column#7;description": "Description",
    },
  },
  extract: function extract (documentIRI, sourceGraphs, ontologies = [ontology, vdoc.ontology]) {
    return vdoc.extract(documentIRI, sourceGraphs, ontologies);
  },
  emit: function emit (emission, vdocson, formatName, ontologies = [ontology, vdoc.ontology]) {
    return vdoc.emit(emission, vdocson, formatName, ontologies);
  },
};
