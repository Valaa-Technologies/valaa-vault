module.exports = function extendOntology (
    preferredPrefix, baseIRI, prefixes = {}, vocabulary = {}, {
      extractionRules = {}, context = {},
    } = {}) {
  // TODO(iridian, 2019-08): Validate the ontology parameters.
  const moreContext = {};
  Object.entries(vocabulary).forEach(([idSuffix, definition]) => {
    let term;
    function defineContextTerm () {
      if (!term) {
        moreContext[`${preferredPrefix}:${idSuffix}`] = term =
          { "@id": `${baseIRI}${idSuffix}` };
      }
      return term;
    }
    const range = definition["rdfs:range"];
    if (range === "rdfs:List") defineContextTerm()["@container"] = "@list";
    if (range
        && (range.slice(0, 4) !== "xsd:")
        && (range !== "rdfs:Literal")
        && (range !== "rdfs:Resource")) {
      defineContextTerm()["@type"] = "@id";
    }
  });
  return {
    [preferredPrefix]: {
      preferredPrefix,
      baseIRI,
      prefixes: {
        ...prefixes,
        [preferredPrefix]: baseIRI,
      },
      vocabulary,
      extractionRules,
      context: {
        ...context,
        ...moreContext,
      },
    },
  };
};
