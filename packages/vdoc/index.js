const patchWith = require("@valos/tools/patchWith").default;

const extractee = require("./extractee");

module.exports = {
  extension: {
    extends: [],
    ontology: require("./ontology"),
    extractors: require("./extractors"),
    emitters: require("./emitters"),
    extractee,
    extract,
    emit,
  },
  extractee,
};

function extract (sourceGraphs, {
  target, documentIRI, extensions = [this, ...this.extends], omitContext,
} = {}) {
  const vdocld = [];
  return patchWith(vdocld, [].concat(sourceGraphs), {
    keyPath: [],
    extractionRules: extensions.reduce((a, { ontology }) =>
        Object.assign(a, ontology.extractionRules || {}), {}),
    preExtend (innerTarget, patch, key, targetObject, patchObject) {
      if (this.keyPath.length === 1) {
        if (!innerTarget) {
          const root = target || {};
          if (documentIRI !== undefined) root["@id"] = documentIRI;
          if (!omitContext) {
            root["@context"] = { "@base": `${documentIRI || ""}#` };
            for (const extension of extensions) {
              Object.assign(root["@context"],
                  extension.ontology.prefixes,
                  extension.ontology.context);
            }
          }
          return this.extend(root, patch);
        }
        this.documentNode = innerTarget;
      }
      for (const extension of extensions) {
        const preExtend = (extension.extractors.native || {}).preExtend;
        if (!preExtend) continue;
        const ret = preExtend.call(this, target, patch, key, targetObject, patchObject);
        if (ret !== undefined) return ret;
      }
      return undefined;
    },
    postExtend (innerTarget, patch, key, targetObject, patchObject) {
      if ((this.keyPath <= 1) && (key === undefined)) return innerTarget;
      let ret;
      for (const extension of extensions) {
        const postExtend = (extension.extractors.native || {}).postExtend;
        if (!postExtend) continue;
        ret = postExtend.call(this, innerTarget, patch, key, targetObject, patchObject);
        if (ret !== undefined) return ret;
      }
      return innerTarget;
    },
  });
}

function emit (emission, vdocld, formatName, extensions = [this, ...this.extends]) {
  return _emitNode(emission, vdocld[0], vdocld[0]);
  function _emitNode (emission_, node, document, explicitType_) {
    const type = explicitType_
        || ((node == null) && "null")
        || node["rdf:type"]
        || (Array.isArray(node) && "array")
        || typeof node;
    let subClassOf;
    for (const extension of extensions) {
      const emitter = extension.emitters[formatName];
      const newEmission = emitter && emitter[type]
          && emitter[type](emission_, node, document, _emitNode, vdocld, extensions);
      if (newEmission !== undefined) return newEmission;
      if (!subClassOf) {
        const [prefix, ontologyType] = type.split(":");
        if (prefix === extension.ontology.prefix) {
          subClassOf = (extension.ontology.vocabulary[ontologyType] || {})["rdfs:subClassOf"];
        }
      }
    }
    return !subClassOf
        ? emission_
        : _emitNode(emission_, node, document, subClassOf);
  }
}
