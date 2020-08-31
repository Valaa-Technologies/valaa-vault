const { extendOntology } = require("@valos/vdoc");

module.exports = {
  ...extendOntology("VScript", "https://valospace.org/script/0#", {}, require("./VScript")),
  ...extendOntology("V", "https://valospace.org/0#", {
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
    xsd: "http://www.w3.org/2001/XMLSchema#",
    owl: "http://www.w3.org/2002/07/owl#",
    dc: "http://purl.org/dc/elements/1.1/",
    VKernel: "https://valospace.org/kernel/0#",
  }, require("./V"), {
    context: {
      restriction: { "@reverse": "owl:onProperty" },
    },
  }),
};
