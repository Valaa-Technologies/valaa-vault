const extendOntology = require("@valos/vdoc/extendOntology");
const { dumpObject, wrapError } = require("@valos/tools/wrapError");
const patchWith = require("@valos/tools/patchWith").default;

module.exports = {
  exportDomainAggregateOntologiesFromDocuments,
};

function exportDomainAggregateOntologiesFromDocuments (domainName, documents) {
  const aggregatedOntologies = Object.create(null);
  const alreadyAggregated = Object.create(null);
  Object.values(documents).forEach(document => {
    if (alreadyAggregated[document.package] || document.package === domainName
        || (document.package === `${domainName}-vault`)
        || !(document.tags || []).includes("ONTOLOGY")) return;
    try {
      // Maybe source from the document vdocstate?
      const ontologies = require(`${document.package}/ontologies`);
      alreadyAggregated[document.package] = true;
      for (const [preferredPrefix, extender] of Object.entries(ontologies)) {
        const current = aggregatedOntologies[preferredPrefix]
            || (aggregatedOntologies[preferredPrefix] =
                { preferredPrefix, baseIRI: extender.baseIRI });
        try {
          if (current.preferredPrefix !== preferredPrefix) {
            throw new Error("preferredPrefix mismatch");
          }
          if (current.baseIRI !== extender.baseIRI) throw new Error("baseIRI mismatch");
          if (!current.ontologyDescription) {
            current.ontologyDescription = extender.ontologyDescription;
          }
          for (const section of ["prefixes", "vocabulary", "context", "extractionRules"]) {
            current[section] = patchWith(current[section] || {}, extender[section], {
              keyPath: [],
              preExtend (currentValue, extenderValue) {
                if (currentValue === extenderValue || (typeof currentValue === "object")
                    || (currentValue == null) || (extenderValue === undefined)) return undefined;
                throw wrapError(new Error(`Ontology aggregation mismatch for '${
                        this.keyPath.join(".")
                        }': extender value and current value string serializations differ`),
                    new Error(`During section '${section}' aggregation`),
                    "\n\tcurrentValue:", JSON.stringify(currentValue),
                    "\n\textenderValue:", JSON.stringify(extenderValue));
              },
            });
          }
          current.mostRecentDocument = document;
        } catch (error) {
          throw wrapError(error,
              new Error(`During exportDomainAggregateOntologiesFromDocuments.extender(prefix: ${
                  preferredPrefix})`),
              "\n\textender:", ...dumpObject(extender),
              "\n\tcurrent document:", (current.mostRecentDocument || {})["@id"],
              (current.mostRecentDocument || {})["dc:title"]
          );
        }
      }
    } catch (error) {
      throw wrapError(error,
          new Error(`During exportDomainAggregateOntologiesFromDocuments(domain: ${
            domainName}, document: ${document["@id"]})`),
          "\n\tdocument title:", document.title,
          "\n\tdocument package:", document.package, document.version);
    }
  });
  return Object.values(aggregatedOntologies).reduce((exports, { vocabulary, ...base }) =>
          Object.assign(exports, extendOntology(vocabulary, { base })),
      {});
}
