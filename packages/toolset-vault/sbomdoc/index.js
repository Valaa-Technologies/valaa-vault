const vdoc = require("@valos/toolset-vault/vdoc");
const revdoc = require("@valos/toolset-vault/revdoc");

const ontology = require("./ontology");
const extractee = require("./extractee");

module.exports = {
  ...vdoc,
  ...revdoc,
  extractee: {
    ...vdoc.extractee,
    ...revdoc.extractee,
    ...extractee,
  },
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
  extract (sourceGraphs, options = {}) {
    if (options.ontologies === undefined) {
      options.ontologies = [ontology, revdoc.ontology, vdoc.ontology];
    }
    return revdoc.extract(sourceGraphs, options);
  },
  emit (emission, vdocson, formatName, ontologies = [ontology, revdoc.ontology, vdoc.ontology]) {
    return revdoc.emit(emission, vdocson, formatName, ontologies);
  },
};
