module.exports = function extendOntology (statements,
    { base = {}, prefixes = {}, extractionRules = {}, ontologyDescription } = {}) {
  const { "@context": context = {}, ontology = {}, ...vocabulary } = statements;
  const preferredPrefix = ontology["rdfs:label"] || base.preferredPrefix;
  const baseIRI = ontology["rdf:about"] || base.baseIRI;
  try {
    if (!preferredPrefix) {
      throw new Error(`Can't determine preferredPrefix: both${
        ""} statements.ontology["rdfs:label"] and base.preferredPrefix are missing`);
    }
    if (!baseIRI) {
      throw new Error(`Can't determine baseIRI: both${
        ""} statements.ontology["rdf:about"] and base.baseIRI missing`);
    }
    // TODO(iridian, 2019-08): Validate the ontology parameters.
    const inferredContext = {};
    Object.entries(vocabulary).forEach(([idSuffix, definition]) => {
      let term;
      const id = `#${idSuffix}`;
      function _expressTermInContext () {
        if (!term) {
          inferredContext[`${preferredPrefix}:${idSuffix}`] = term = { "@id": id };
        }
        return term;
      }
      const range = definition["rdfs:range"];
      if (range === "rdfs:List") _expressTermInContext()["@container"] = "@list";
      if (range
          && (range.slice(0, 4) !== "xsd:")
          && (range !== "rdfs:Literal")
          && (range !== "rdfs:Resource")) {
        _expressTermInContext()["@type"] = "@id";
      }
      let label;
      switch (definition["@type"]) {
        case "VModel:Type":
        case "VKernel:Class":
          break;
        case "VModel:Field":
        case "VModel:ExpressedField":
        case "VModel:EventLoggedField":
        case "VModel:CoupledField":
        case "VModel:GeneratedField":
        case "VModel:TransientField":
        case "VModel:AliasField": {
          label = `$${preferredPrefix}.${idSuffix}`;
          _addInferredIndex("VEngine:domainOfField", "rdfs:domain",
              definition["VRevdoc:indexLabel"] || `.${label}`);
          break;
        }
        case "VEngine:Property":
          _addInferredIndex("VEngine:domainOfProperty", "rdfs:domain",
              definition["VRevdoc:indexLabel"]);
          break;
        case "VEngine:Method":
          _addInferredIndex("VEngine:domainOfMethod", "rdfs:domain",
              definition["VRevdoc:indexLabel"]);
          break;
        case "VEngine:ObjectProperty":
          _addInferredIndex("VEngine:hasProperty", "rdf:subject",
              definition["VRevdoc:indexLabel"]);
          break;
        case "VEngine:ObjectMethod":
          _addInferredIndex("VEngine:hasMethod", "rdf:subject",
              definition["VRevdoc:indexLabel"]);
          break;
        default:
          break;
      }
      if (!definition["rdfs:label"] && label) definition["rdfs:label"] = [label];
      function _addInferredIndex (indexProperty, indexIdProperty, indexLabel) {
        if (!indexLabel || (typeof definition[indexIdProperty] !== "string")) return;
        const [indexPrefix, indexName] = definition[indexIdProperty].split(":");
        if (indexPrefix !== preferredPrefix) return;
        const indexDefinition = vocabulary[indexName];
        if (!indexDefinition) return;
        const values = indexDefinition[indexProperty] || (indexDefinition[indexProperty] = []);
        if (values.find(({ "@id": existingId }) => (existingId === id))) return;
        values.push({ "@id": id, "VRevdoc:indexLabel": indexLabel });
      }
    });
    return {
      [preferredPrefix]: {
        preferredPrefix,
        baseIRI,
        ontologyDescription: ontologyDescription
            || ontology["rdfs:comment"] || base.ontologyDescription || "",
        prefixes: {
          rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
          rdfs: "http://www.w3.org/2000/01/rdf-schema#",
          xsd: "http://www.w3.org/2001/XMLSchema#",
          owl: "http://www.w3.org/2002/07/owl#",
          dc: "http://purl.org/dc/elements/1.1/",
          ...base.prefixes,
          ...prefixes,
          [preferredPrefix]: baseIRI,
        },
        vocabulary,
        context: {
          "@base": baseIRI,
          ...base.context,
          ...context,
          ...inferredContext,
        },
        extractionRules,
      },
    };
  } catch (error) {
    throw error;
  }
};
