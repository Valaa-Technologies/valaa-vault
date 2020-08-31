const { exportDomainAggregateOntologiesFromDocuments } = require("@valos/type-domain");
const { createRemovedFromOntology } = require("@valos/raem/tools/createRemovedFromOntology");

module.exports = exportDomainAggregateOntologiesFromDocuments(
    require("./package").name, require("./documents"));

Object.assign(module.exports,
    createRemovedFromOntology("VRemovedFrom", "https://valospace.org/removed-from/0#",
        module.exports.V));

/*
module.exports = {
  ...extendOntology(preferredPrefix, baseIRI, {
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
    xsd: "http://www.w3.org/2001/XMLSchema#",
    owl: "http://www.w3.org/2002/07/owl#",
    dc: "http://purl.org/dc/elements/1.1/",
    VKernel: "https://valospace.org/kernel/0#",
    VDoc: "https://valospace.org/vdoc/0#",
    V: "https://valospace.org/0#",
  }, vocabulary);
};
*/
