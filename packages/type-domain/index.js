const { extendOntology } = require("@valos/vdoc");
const { wrapError } = require("@valos/tools/wrapError");

module.exports = {
  exportDomainAggregateOntologiesFromDocuments,
};

function exportDomainAggregateOntologiesFromDocuments (name, documents) {
  const preOntologies = {};
  Object.values(documents).forEach(document => {
    if (document.package === name
        || !(document.tags || []).includes("ONTOLOGY")) return;

    // Maybe source from the document vdocld?
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
            new Error(`During exportDomainAggregateOntologiesFromDocuments(${name})`),
            "\n\tconflicting new document:", document["@id"], document["dc:title"],
            "\n\tconflicted previous document:", current.mostRecentDocument["@id"],
                current.mostRecentDocument["dc:title"]);
      }
    }
  });
  return Object.values(preOntologies).reduce(
      (exports, { prefix, prefixIRI, prefixes, vocabulary, ...rest }) =>
          Object.assign(exports, extendOntology(prefix, prefixIRI, prefixes, vocabulary, rest)),
      {});
}
