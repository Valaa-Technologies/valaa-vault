const { extendOntology } = require("@valos/vdoc");

const prefixes = {
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  owl: "http://www.w3.org/2002/07/owl#",
  dc: "http://purl.org/dc/elements/1.1/",
  revela: "https://valospace.org/inspire/revela#",
};

module.exports = {
  ...extendOntology("revela", prefixes.revela, prefixes, require("./revela")),
};
