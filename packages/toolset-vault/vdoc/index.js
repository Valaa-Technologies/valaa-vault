// @flow

const patchWith = require("~/tools/patchWith").default;

const vdocOntology = require("./ontology");

module.exports = {
  ontology: vdocOntology,
  ref,
  extract,
  emit,
};

function ref (text, ref_ = text, style) {
  const ret = { "rdf:type": "vdoc:Reference", "vdoc:entries": [text], "vdoc:ref": ref_ };
  if (style) ret["vdoc:style"] = style;
  return ret;
}

function extract (documentIRI, sourceGraphs: Object | Object[],
    ontologies: Object[] = [vdocOntology]) {
  const vsonldoc = [];
  return patchWith(vsonldoc, [].concat(sourceGraphs), {
    keyPath: [],
    preExtend (target, patch, key, targetObject, patchObject) {
      if (this.keyPath.length === 1) {
        if (!target) {
          const documentContext = { "@base": `${documentIRI}#` };
          for (const ontology of ontologies) {
            Object.assign(documentContext, ontology.prefixes, ontology.context);
          }
          return this.extend({ "@context": documentContext, "@id": documentIRI }, patch);
        }
        this.documentNode = target;
      }
      for (const ontology of ontologies) {
        if (!ontology.extractor.preExtend) continue;
        const ret = ontology.extractor.preExtend.call(
            this, target, patch, key, targetObject, patchObject);
        if (ret !== undefined) return ret;
      }
      return undefined;
    },
    postExtend (target, patch, key, targetObject, patchObject) {
      if ((this.keyPath <= 1) && (key === undefined)) return target;
      let ret;
      for (const ontology of ontologies) {
        if (!ontology.extractor.postExtend) continue;
        ret = ontology.extractor.postExtend.call(
            this, target, patch, key, targetObject, patchObject);
        if (ret !== undefined) break;
      }
      if (ret === undefined) ret = target;
      return (ret === null) ? undefined : ret;
    },
  });
}

function emit (emission, vsonldoc: Object, ontologies: Object[], formatName: string) {
  return _emitNode(emission, vsonldoc[0], vsonldoc[0]);
  function _emitNode (emission_: any, node: Object, document: Object) {
    const type = ((node != null) && node["rdf:type"])
        || (Array.isArray(node) && "array")
        || typeof node;
    for (const ontology of ontologies) {
      const emitter = ontology.emitters[formatName];
      const newEmission = emitter && emitter[type] && emitter[type](
          emission_, node, document, _emitNode, vsonldoc, ontologies);
      if (newEmission !== undefined) return newEmission;
    }
    return emission_;
  }
}
