module.exports = function extendOntology (prefix, prefixIRI, prefixes = {}, vocabulary = {}, {
  extractionRules = {}, context = {},
} = {}) {
  // TODO(iridian, 2019-08): Validate the ontology parameters.
  const moreContext = {};
  Object.entries(vocabulary).forEach(([idSuffix, definition]) => {
    let term;
    function define () {
      if (!term) moreContext[`${prefix}:${idSuffix}`] = term = { "@id": `${prefixIRI}${idSuffix}` };
      return term;
    }
    const range = definition["rdfs:range"];
    if (range === "rdfs:List") define()["@container"] = "@list";
    if (range
        && (range.slice(0, 4) !== "xsd:")
        && (range !== "rdfs:Literal")
        && (range !== "rdfs:Resource")) {
      define()["@type"] = "@id";
    }
  });
  return {
    [prefix]: {
      prefix,
      prefixIRI,
      prefixes: {
        ...prefixes,
        [prefix]: prefixIRI,
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
