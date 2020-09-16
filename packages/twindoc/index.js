const vdoc = require("@valos/vdoc");

module.exports = {
  extension: {
    ...vdoc.extension,
    extends: [vdoc.extension],
    getNamespace: () => require("./ontology").VTwindoc,
    extractors: require("./extractors"),
    emitters: require("./emitters"),
    extractee: {},
  },
};
