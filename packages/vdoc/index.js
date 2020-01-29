const patchWith = require("@valos/tools/patchWith").default;
const { wrapError, dumpObject } = require("@valos/tools/wrapError");

const extractee = require("./extractee");

module.exports = {
  extension: {
    extends: [],
    ontology: require("./ontologies").vdoc,
    extractors: require("./extractors"),
    emitters: require("./emitters"),
    extractee,
    extract,
    emit,
  },
  extractee,
  extendOntology: require("./extendOntology"),
};

function extract (sourceGraphs, {
  target, documentIRI, extensions = [this, ...this.extends], omitContext,
} = {}) {
  const vdocState = [];
  try {
    return patchWith(vdocState, [].concat(sourceGraphs), {
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
  } catch (error) {
    throw wrapError(error, new Error(`During extract("${(this.ontology || {}).prefix}")`),
        "\n\tdocumentIRI:", documentIRI,
        "\n\textensions:", ...dumpObject(extensions),
        "\n\tsourceGraphs:", ...dumpObject(sourceGraphs));
  }
}

function emit (vdocState, formatName, options) {
  if (options.extensions === undefined) options.extensions = [this, ...this.extends];
  if (options.document === undefined) options.document = vdocState[0];
  if (options.vdocState === undefined) options.vdocState = vdocState;
  options.emitNode = function emitNode (node, target, explicitType) {
    const type = explicitType
        || ((node == null) && "null")
        || node["@type"]
        || (Array.isArray(node) && "array")
        || typeof node;
    let subClassOf;
    try {
      for (const extension of this.extensions) {
        const emitter = extension.emitters[formatName];
        const newEmission = emitter && emitter[type]
            && emitter[type](node, target, this);
        if (newEmission !== undefined) return newEmission;
        if (!subClassOf) {
          const [prefix, ontologyType] = type.split(":");
          if (prefix === extension.ontology.prefix) {
            subClassOf = (extension.ontology.vocabulary[ontologyType] || {})["rdfs:subClassOf"];
          }
        }
      }
    } catch (error) {
      throw wrapError(error, new Error(`During emitNode(${formatName}, ${type})`),
          "\n\tnode:", ...dumpObject(node));
    }
    if (!subClassOf) return target;
    return this.emitNode(node, target, subClassOf);
  };
  return options.emitNode(vdocState[0], options.target);
}
