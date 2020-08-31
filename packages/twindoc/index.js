const vdoc = require("@valos/vdoc");

module.exports = {
  extension: {
    ...vdoc.extension,
    extends: [vdoc.extension],
    ontology: require("./ontologies").VTwindoc,
    extractors: require("./extractors"),
    emitters: require("./emitters"),
    extractee: {},
  },
};
