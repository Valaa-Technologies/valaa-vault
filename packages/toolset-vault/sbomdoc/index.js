const vdoc = require("@valos/toolset-vault/vdoc");

const ontology = require("./ontology");
const extractee = require("./extractee");

module.exports = {
  ...vdoc,
  extractee: {
    ...vdoc.extractee,
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
    if (options.ontologies === undefined) options.ontologies = [ontology, vdoc.ontology];
    return vdoc.extract(sourceGraphs, options);
  },
  emit (emission, vdocson, formatName, ontologies = [ontology, vdoc.ontology]) {
    return vdoc.emit(emission, vdocson, formatName, ontologies);
  },
};
