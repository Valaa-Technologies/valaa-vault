const { exportWorkshopAggregateOntologiesFromDocuments } = require("@valos/type-workshop");

module.exports = exportWorkshopAggregateOntologiesFromDocuments(
    require("./package").name, require("./documents"));

/*
module.exports = {
  ...extendOntology(prefix, prefixIRI, {
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
    xsd: "http://www.w3.org/2001/XMLSchema#",
    owl: "http://www.w3.org/2002/07/owl#",
    dc: "http://purl.org/dc/elements/1.1/",
    "valos-kernel": "https://valospace.org/kernel#",
    vdoc: "https://valospace.org/vdoc#",
    valos: "https://valospace.org/#",
  }, vocabulary);
};
*/
