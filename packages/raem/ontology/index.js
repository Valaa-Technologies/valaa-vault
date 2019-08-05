module.exports = {
  prefix: "valos",
  prefixIRI: "https://valospace.org/#",
  prefixes: {
    dc: "http://purl.org/dc/elements/1.1/",
    owl: "http://www.w3.org/2002/07/owl#",
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
    valos: "https://valospace.org/#",
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
};
