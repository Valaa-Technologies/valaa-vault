const { extendOntology } = require("@valos/vdoc");

const prefixes = {
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  owl: "http://www.w3.org/2002/07/owl#",
  dc: "http://purl.org/dc/elements/1.1/",
  "valos-kernel": "https://valospace.org/kernel#",
};

module.exports = {
  ...extendOntology("valos-kernel", "https://valospace.org/kernel#", prefixes,
      require("./valos-kernel")),
  ...extendOntology("valos-valk", "https://valospace.org/valk#", prefixes, require("./valos-valk")),
  ...extendOntology("valos-raem", "https://valospace.org/raem#", prefixes, require("./valos-raem")),
  ...extendOntology("valos", "https://valospace.org/#", prefixes, require("./valos"), {
    context: {
      restriction: { "@reverse": "owl:onProperty" },
    },
  }),
};
