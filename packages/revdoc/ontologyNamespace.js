const { dumpObject, wrapError } = require("@valos/tools/wrapError");
const patchWith = require("@valos/tools/patchWith").default;

module.exports = {
  defineNamespace,
  extendNamespace,
  revdocOntologyProperties,
  obtainFullVocabulary,
};

function defineNamespace (namespace) {
  const { domain, preferredPrefix, baseIRI, ...rest } = namespace;
  if (!domain) throw new Error(`Missing namespace.domain`);
  if (!preferredPrefix) throw new Error(`Missing namespace.preferredPrefix`);
  if (!baseIRI) throw new Error(`Missing namespace.baseIRI`);
  const alreadyAggregated = Object.create(null);
  const aggregate = { base: namespace, ...rest };
  if (!namespace.aggregate) {
    const { documents } = require(domain);
    for (const document of Object.values(documents)) _aggregateDocument(document);
    namespace.aggregate = extendNamespace(aggregate)[preferredPrefix];
  }
  return { [preferredPrefix]: namespace.aggregate };

  function _aggregateDocument (document) {
    const extenderModule = (document["VRevdoc:extenderModules"] || {})[baseIRI];
    if (!extenderModule || alreadyAggregated[extenderModule]) return;
    let extender;
    try {
      alreadyAggregated[extenderModule] = true;
      extender = require(extenderModule);
      if (!extender.base) return; // this is the defineNamespace module itself
      if (extender.base.preferredPrefix !== preferredPrefix) {
        throw new Error(`Mismatch between extender.base.preferredPrefix '${
            extender.base.preferredPrefix}' and aggregated preferredPrefix '${preferredPrefix}'`);
      }
      if (extender.base.baseIRI !== baseIRI) {
        throw new Error(`Mismatch between extender.base.baseIRI '${
            extender.base.baseIRI}' and aggregated baseIRI '${baseIRI}'`);
      }
      for (const section of [
        "prefixes", "context", "namespaceModules", "description", "vocabulary", "extractionRules",
      ]) {
        aggregate[section] = patchWith(aggregate[section], extender[section], {
          keyPath: [],
          preExtend (currentValue, extenderValue) {
            if ((currentValue === extenderValue)
                || (typeof currentValue === "object")
                || (currentValue == null)
                || (extenderValue === undefined)) {
              return undefined;
            }
            throw wrapError(new Error(`Ontology namespace aggregation conflict at '${
                    this.keyPath.join(".")
                    }': extender value and current values differ`),
                new Error(`When aggregating section '${section}'`),
                "\n\tcurrentValue:", JSON.stringify(currentValue),
                "\n\textenderValue:", JSON.stringify(extenderValue));
          },
        });
      }
    } catch (error) {
      throw wrapError(error,
          new Error(`During defineNamespace(${preferredPrefix} in ${domain
              })._aggregateDocument(${document["@id"]})`),
          "\n\tdocument title:", document.title,
          "\n\tdocument package:", document.package, document.version,
          "\n\textender module:", extenderModule,
      );
    }
  }
}

function obtainFullVocabulary (referencedModule) {
  const namespace = require(referencedModule);
  if (!namespace.aggregate) defineNamespace(namespace);
  return namespace.aggregate.vocabulary;
}

function extendNamespace (namespace) {
  const {
    base,
    extenderModule,
    namespaceModules = {},
    prefixes = {},
    context = {},
    vocabulary = {},
    extractionRules = {},
    referencedModules = {},
    ...primary
  } = namespace;
  if (!base) throw new Error(`No namespace.base specified`);
  const preferredPrefix = base.preferredPrefix;
  const baseIRI = base.baseIRI;
  let ontologyNamespace;
  try {
    if (!preferredPrefix) throw new Error(`No namespace.base.preferredPrefix`);
    if (!baseIRI) throw new Error(`No namespace.base.baseIRI`);
    ontologyNamespace = {
      preferredPrefix,
      baseIRI,
      extenderModule,
      description: primary.description || base.description || "",
      namespaceModules,
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
      context: {
        ...base.context,
        ...context,
        "@base": baseIRI,
      },
      vocabulary,
      extractionRules,
      referencedModules: { ...referencedModules },
    };
    for (const [referringPrefix, referredModule] of Object.entries(namespaceModules)) {
      const referredNamespace = require(referredModule);
      if (referredNamespace == null) {
        console.log("null require!", referredModule);
      }
      if (!referredNamespace.preferredPrefix) {
        console.log("referredNamespace:", referredNamespace);
        throw new Error(`No require("${referredModule
            }").preferredPrefix defined when resolving reference prefix '${referringPrefix}'`);
      }
      const referredBaseIRI = referredNamespace.baseIRI;
      if (!referredBaseIRI) {
        throw new Error(`No require("${referredModule
            }").baseIRI defined when resolving reference prefix '${referringPrefix}'`);
      }
      const currentBaseIRI = ontologyNamespace.prefixes[referringPrefix];
      if (!currentBaseIRI) {
        ontologyNamespace.prefixes[referringPrefix] = referredBaseIRI;
      } else if (currentBaseIRI !== referredBaseIRI) {
        throw new Error(`baseIRI mismatch between current <${currentBaseIRI
            }> and '${referringPrefix}' reference baseIRI <${referredBaseIRI}>`);
      }
      ontologyNamespace.referencedModules[referredBaseIRI] = referredModule;
    }

    // TODO(iridian, 2019-08): Validate the ontology parameters.
    Object.entries(vocabulary).forEach(([idSuffix, definition]) => {
      let term;
      const id = `#${idSuffix}`;
      function _expressTermInContext () {
        if (!term) {
          ontologyNamespace.context[`${preferredPrefix}:${idSuffix}`] = term = { "@id": id };
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
          _addInferredIndex("VEngine:domainOfProperty", definition["rdfs:domain"],
              definition["VRevdoc:indexLabel"]);
          break;
        case "VEngine:Method":
          _addInferredIndex("VEngine:domainOfMethod", definition["rdfs:domain"],
              definition["VRevdoc:indexLabel"]);
          break;
        case "VEngine:ObjectProperty":
          _addInferredIndex("VEngine:hasProperty", definition["rdf:subject"],
              definition["VRevdoc:indexLabel"]);
          break;
        case "VEngine:ObjectMethod":
          _addInferredIndex("VEngine:hasMethod", definition["rdf:subject"],
              definition["VRevdoc:indexLabel"]);
          break;
        default:
          break;
      }
      if (!definition["rdfs:label"] && label) definition["rdfs:label"] = [label];
      function _addInferredIndex (indexProperty, indexNames, indexLabel) {
        if (!indexNames || !indexLabel) return;
        if (Array.isArray(indexNames)) {
          indexNames.forEach((indexName, index) => _addInferredIndex(
              indexProperty, indexName,
              Array.isArray(indexLabel) ? indexLabel[index] : indexLabel));
          return;
        }
        const [indexPrefix, indexName] = indexNames.split(":");
        if (indexPrefix !== preferredPrefix) return;
        const indexDefinition = vocabulary[indexName];
        if (!indexDefinition) return;
        const values = indexDefinition[indexProperty] || (indexDefinition[indexProperty] = []);
        if (values.find(({ "@id": existingId }) => (existingId === id))) return;
        values.push({ "@id": id, "VRevdoc:indexLabel": indexLabel });
      }
    });
    return { [preferredPrefix]: ontologyNamespace };
  } catch (error) {
    throw wrapError(error, new Error(`extendNamespace(${preferredPrefix} = <${baseIRI}>)`),
        "\n\tprimary:", ...dumpObject(primary),
    );
  }
}

const VEngine = "https://valospace.org/engine/0#";

function revdocOntologyProperties ({ prefixes, context, referencedModules }, remainingOntology) {
  const ret = {
    "@context": {
      VEngine,
      ...prefixes,
      ...context,
    },
    "VRevdoc:referencedModules": {
      [VEngine]: "@valos/engine/VEngine",
      ...referencedModules,
    },
    "VRevdoc:extenderModules": {},
  };
  for (const namespace of Object.values(remainingOntology)) {
    if (namespace.extenderModule) {
      ret["VRevdoc:extenderModules"][namespace.baseIRI] = namespace.extenderModule;
    }
  }
  return ret;
}
