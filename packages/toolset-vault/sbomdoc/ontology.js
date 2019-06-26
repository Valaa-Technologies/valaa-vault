// @flow

// const { ontology } = require("~/toolset-vault/vdoc");

module.exports = {
  prefixes: {
    sbomdoc: "https://valaatech.github.io/vault/sbomdoc#",
  },
  context: {
  },
  vocabulary: {
    Document: { "rdfs:subClassOf": "vdoc:Chapter" },
  },
  extractionRules: {
  },
  extractor: {
    preExtend (target, /* patch, key, targetObject, patchObject */) {
      if (target && (this.keyPath.length === 1)) {
        target["rdf:type"] = "vdoc:Document";
      }
    },
  },
  emitters: {
    html: {
      "vdoc:Document": emitSBoMDocHTML,
      "sbomdoc:Document": emitSBoMDocHTML,
    },
  },
};

function emitSBoMDocHTML (emission, node, document, emitNode /* , vdocson, emitters */) {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset='utf-8'>
    <title>${node["vdoc:title"]}</title>
  </head>
  <body>
    ${emitNode("", node["vdoc:content"], document)}
  </body>
</html>
`;
}
