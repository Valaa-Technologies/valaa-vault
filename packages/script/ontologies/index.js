const { extendOntology } = require("@valos/vdoc");

module.exports = {
  ...extendOntology("valos_script", "https://valospace.org/script#", {}, {}),
  ...extendOntology("valos", "https://valospace.org/#", {
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
    xsd: "http://www.w3.org/2001/XMLSchema#",
    owl: "http://www.w3.org/2002/07/owl#",
    dc: "http://purl.org/dc/elements/1.1/",
    valos_kernel: "https://valospace.org/kernel#",
  }, require("./valos"), {
    context: {
      restriction: { "@reverse": "owl:onProperty" },
    },
  }),
};
