const extendOntology = require("@valos/vdoc/extendOntology");
const { dumpObject, wrapError } = require("@valos/tools/wrapError");

module.exports = {
  exportDomainAggregateOntologiesFromDocuments,
};

function exportDomainAggregateOntologiesFromDocuments (domainName, documents) {
  const aggregatedOntologies = {};
  Object.values(documents).forEach(document => {
    if (document.package === domainName
        || (document.package === `${domainName}-vault`)
        || !(document.tags || []).includes("ONTOLOGY")) return;
    try {
      // Maybe source from the document vdocstate?
      const ontologies = require(`${document.package}/ontologies`);
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
            const target = current[section] || (current[section] = {});
            for (const [key, extenderValue] of Object.entries(extender[section] || {})) {
              const currentValue = target[key];
              if (currentValue === undefined) {
                target[key] = extenderValue;
              } else if (JSON.stringify(extenderValue) !== JSON.stringify(currentValue)) {
                  throw wrapError(new Error(`Ontology aggregation mismatch for '${key
                          }': extender value and current value string serializations differ`),
                      new Error(`During section '${section}' aggregation`),
                      "\n\tcurrentValue:", JSON.stringify(currentValue),
                      "\n\textenderValue:", JSON.stringify(extenderValue));
              }
            }
          }
          current.mostRecentDocument = document;
        } catch (error) {
          throw wrapError(error,
              new Error(`During exportDomainAggregateOntologiesFromDocuments.extender(prefix: ${
                  preferredPrefix})`),
              "\n\textender:", ...dumpObject(extender),
              "\n\tcurrent document:", current.mostRecentDocument["@id"],
                  current.mostRecentDocument["dc:title"]
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
