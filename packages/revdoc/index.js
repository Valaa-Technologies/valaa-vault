const vdoc = require("@valos/vdoc");
const extractee = require("./extractee");

module.exports = {
  extension: {
    ...vdoc.extension,
    extends: [vdoc.extension],
    getNamespace: () => require("./ontology").VRevdoc,
    extractors: require("./extractors"),
    emitters: require("./emitters"),
    extractee,
  },
  extractee: {
    ...vdoc.extractee,
    ...extractee,
    /**
     * Construct ReSpec authors section based on the @valos/type-vault
     * valma configuration of the current working directory.
     *
     * @param {*} authorNames
     * @returns
     */
    authors (...authorNames) {
      const toolsetsPath = `${process.cwd()}/toolsets.json`;
      const authorLookup = (((require(toolsetsPath)["@valos/type-vault"] || {})
          .tools || {}).docs || {}).authors || {};
      return (authorNames || []).map(authorName => {
        const author = authorLookup[authorName];
        if (!author) {
          throw new Error(`Cannot find author '${authorName}' from toolsetConfig("${
            toolsetsPath}")["@valos/type-vault"].tools.docs.authors`);
        }
        return author;
      });
    },
  },
  ontologyColumns: require("./ontologyColumns"),
  ...require("./ontologyNamespace"),
};
