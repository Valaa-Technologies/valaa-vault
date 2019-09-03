const { exportWorkshopAggregateOntologiesFromDocuments } = require("@valos/type-workshop");

module.exports = exportWorkshopAggregateOntologiesFromDocuments(
    require("./package").name, require("./documents"));
