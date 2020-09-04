const { exportDomainAggregateOntologiesFromDocuments } = require("@valos/type-domain");
const { createRemovedFromOntology } = require("@valos/raem/tools/createRemovedFromOntology");

module.exports = exportDomainAggregateOntologiesFromDocuments(
    require("./package").name, require("./documents"));

Object.assign(module.exports,
    createRemovedFromOntology("VRemovedFrom", "https://valospace.org/removed-from/0#",
        module.exports.V));
