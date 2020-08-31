const vdoc = require("@valos/vdoc");
const revdoc = require("@valos/revdoc");

const extractee = require("./extractee");

module.exports = {
  extension: {
    ...vdoc.extension,
    ...revdoc.extension,
    extends: [revdoc.extension, vdoc.extension],
    ontology: require("./ontologies").VSbomdoc,
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
      "header#0;name": "Name",
      "header#1;group": "Group",
      "header#2;type": "Type",
      "header#3;version": "Version",
      "header#4;modified": "Modified",
      "header#5;licenses": "Licenses",
      "header#6;purl": "PURL",
      "header#7;description": "Description",
    },
  },
};
