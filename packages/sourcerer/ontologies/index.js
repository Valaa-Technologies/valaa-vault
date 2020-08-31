const { extendOntology } = require("@valos/vdoc");

const prefixes = {
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  owl: "http://www.w3.org/2002/07/owl#",
  dc: "http://purl.org/dc/elements/1.1/",
  VKernel: "https://valospace.org/kernel/0#",
  VModel: "https://valospace.org/raem/0#",
  VSourcerer: "https://valospace.org/sourcerer/0#",
  V: "https://valospace.org/0#",
};

module.exports = {
  ...extendOntology("VSourcerer", prefixes.VSourcerer,
      prefixes,
      require("./VSourcerer"), {
        context: {
          aspects: { "@reverse": "VSourcerer:event" },
        }
      }),
  ...extendOntology("V", prefixes.V,
      prefixes,
      require("./V"), {
        context: {
          restriction: { "@reverse": "owl:onProperty" },
        },
      }),
};
