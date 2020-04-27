const { extendOntology } = require("@valos/vdoc");
const { dumpObject, wrapError } = require("@valos/tools/wrapError");

module.exports = {
  exportDomainAggregateOntologiesFromDocuments,
};

function exportDomainAggregateOntologiesFromDocuments (domainName, documents) {
  const preOntologies = {};
  Object.values(documents).forEach(document => {
    if (document.package === domainName
        || (document.package === `${domainName}-vault`)
        || !(document.tags || []).includes("ONTOLOGY")) return;
    try {
      // Maybe source from the document vdocstate?
      const ontologies = require(`${document.package}/ontologies`);
      for (const [prefix, source] of Object.entries(ontologies)) {
        const current = preOntologies[prefix]
            || (preOntologies[prefix] = { prefix, prefixIRI: source.prefixIRI });
        try {
          if (current.prefix !== prefix) throw new Error("prefix mismatch");
          if (current.prefixIRI !== source.prefixIRI) throw new Error("prefixIRI mismatch");
          for (const section of ["prefixes", "vocabulary", "context"]) {
            const target = current[section] || (current[section] = {});
            for (const [key, aggregateValue] of Object.entries(source[section] || {})) {
              const currentValue = target[key];
              if (currentValue === undefined) {
                target[key] = aggregateValue;
              } else if (JSON.stringify(aggregateValue) !== JSON.stringify(currentValue)) {
                  throw wrapError(new Error(`Ontology aggregation mismatch for '${key
                          }': source value and current value string serializations differ`),
                      new Error(`During section '${section}' aggregation`),
                      "\n\tcurrentValue:", JSON.stringify(currentValue),
                      "\n\taggregateValue:", JSON.stringify(aggregateValue));
              }
            }
          }
          current.mostRecentDocument = document;
        } catch (error) {
          throw wrapError(error,
              new Error(`During exportDomainAggregateOntologiesFromDocuments.ontology(prefix: ${
                  prefix})`),
              "\n\tsource:", ...dumpObject(source),
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
  return Object.values(preOntologies).reduce(
      (exports, { prefix, prefixIRI, prefixes, vocabulary, ...rest }) =>
          Object.assign(exports, extendOntology(prefix, prefixIRI, prefixes, vocabulary, rest)),
      {});
}
