const patchWith = require("@valos/tools/patchWith").default;

const vdocOntology = require("./ontology");
const extractee = require("./extractee");

module.exports = {
  extractee,
  ontology: vdocOntology,
  extract,
  emit,
};

function extract (sourceGraphs, {
  target, documentIRI, ontologies = [vdocOntology], omitContext,
} = {}) {
  const vdocson = [];
  return patchWith(vdocson, [].concat(sourceGraphs), {
    keyPath: [],
    preExtend (innerTarget, patch, key, targetObject, patchObject) {
      if (this.keyPath.length === 1) {
        if (!innerTarget) {
          const root = target || {};
          if (documentIRI !== undefined) root["@id"] = documentIRI;
          if (!omitContext) {
            root["@context"] = { "@base": `${documentIRI || ""}#` };
            for (const ontology of ontologies) {
              Object.assign(root["@context"], ontology.prefixes, ontology.context);
            }
          }
          return this.extend(root, patch);
        }
        this.documentNode = innerTarget;
      }
      for (const ontology of ontologies) {
        if (!ontology.extractor.preExtend) continue;
        const ret = ontology.extractor.preExtend.call(
            this, target, patch, key, targetObject, patchObject);
        if (ret !== undefined) return ret;
      }
      return undefined;
    },
    postExtend (innerTarget, patch, key, targetObject, patchObject) {
      if ((this.keyPath <= 1) && (key === undefined)) return innerTarget;
      let ret;
      for (const ontology of ontologies) {
        if (!ontology.extractor.postExtend) continue;
        ret = ontology.extractor.postExtend.call(
            this, innerTarget, patch, key, targetObject, patchObject);
        if (ret !== undefined) return ret;
      }
      return innerTarget;
    },
  });
}

function emit (emission, vdocson, formatName, ontologies = [vdocOntology]) {
  return _emitNode(emission, vdocson[0], vdocson[0]);
  function _emitNode (emission_, node, document, explicitType_) {
    const type = explicitType_
        || ((node != null) && node["rdf:type"])
        || (Array.isArray(node) && "array")
        || typeof node;
    let subClassOf;
    for (const ontology of ontologies) {
      const emitter = ontology.emitters[formatName];
      const newEmission = emitter && emitter[type]
          && emitter[type](emission_, node, document, _emitNode, vdocson, ontologies);
      if (newEmission !== undefined) return newEmission;
      if (!subClassOf) {
        const [prefix, ontologyType] = type.split(":");
        if (prefix === ontology.prefix) {
          subClassOf = (ontology.vocabulary[ontologyType] || {})["rdfs:subClassOf"];
        }
      }
    }
    return !subClassOf
        ? emission_
        : _emitNode(emission_, node, document, subClassOf);
  }
}
