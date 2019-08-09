const { createOntology } = require("@valos/vdoc");

module.exports = createOntology("valos", "https://valospace.org/#", {
  prefixes: {
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
    xsd: "http://www.w3.org/2001/XMLSchema#",
    owl: "http://www.w3.org/2002/07/owl#",
    dc: "http://purl.org/dc/elements/1.1/",
  },
  vocabulary: {
    ...require("./valos"),
    ...require("./Bvob"),
    ...require("./TransientFields"),
    ...require("./Resource"),
    ...require("./InactiveResource"),
    ...require("./DestroyedResource"),
    ...require("./Partition"),
  },
});
