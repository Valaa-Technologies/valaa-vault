const vdoc = require("@valos/type-vault/vdoc");
const revdoc = require("@valos/type-vault/revdoc");

const extractee = require("./extractee");

module.exports = {
  extension: {
    ...vdoc.extension,
    ...revdoc.extension,
    extends: [revdoc.extension, vdoc.extension],
    ontology: require("./ontology"),
    extractors: {},
    emitters: require("./emitters"),
    extractee,
  },
  extractee: {
    ...vdoc.extractee,
    ...revdoc.extractee,
    ...extractee,
  },
  sbomTables: {
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
};
