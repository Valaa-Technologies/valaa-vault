// @flow

// const { ontology } = require("~/toolset-vault/vdoc");

module.exports = {
  prefix: "sbomdoc",
  base: "https://valaatech.github.io/vault/toolset-vault/sbomdoc#",

  prefixes: {
    sbomdoc: "https://valaatech.github.io/vault/toolset-vault/sbomdoc#",
  },
  context: {
  },
  vocabulary: {
    Document: { a: "rdfs:class", "rdfs:subClassOf": "vdoc:Chapter",
      "rdfs:comment": "A Software Bill of Materials document",
    },
  },
  extractionRules: {
  },
  extracteeAPI: {},
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
    <title>${node["dc:title"]}</title>
  </head>
  <body>
    ${emitNode("", node["vdoc:content"], document)}
  </body>
</html>
`;
}
