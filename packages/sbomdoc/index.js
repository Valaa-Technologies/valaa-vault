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
      "column#00;name": "Name",
      "column#01;group": "Group",
      "column#02;type": "Type",
      "column#03;version": "Version",
      "column#04;modified": "Modified",
      "column#05;licenses": "Licenses",
      "column#06;purl": "PURL",
      "column#07;description": "Description",
    },
  },
};
