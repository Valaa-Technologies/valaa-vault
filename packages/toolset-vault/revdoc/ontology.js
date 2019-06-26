const { ontology } = require("@valos/toolset-vault/vdoc");

module.exports = {
  prefixes: {
    revdoc: "https://valaatech.github.io/vault/revdoc#",
  },
  context: {
  },
  vocabulary: {
    Document: { "rdfs:subClassOf": "vdoc:Chapter" },
    Definition: { "rdfs:subClassOf": "vdoc:Node" },
  },
  extractionRules: {
  },
  extractor: {
    preExtend (target, /* patch, key, targetObject, patchObject */) {
      if (target && (this.keyPath.length === 1)) {
        target["rdf:type"] = "revdoc:Document";
      }
    },
  },
  emitters: {
    html: {
      "vdoc:Document": emitReVDocHTML,
      "revdoc:Document": emitReVDocHTML,
      "vdoc:Chapter": emitReVDocChapter,
    },
  },
};

function emitReVDocHTML (emission, node, document, emitNode /* , vdocson, emitters */) {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset='utf-8'>
    <title>${node["vdoc:title"]}</title>
    <script
     src='https://www.w3.org/Tools/respec/respec-w3c-common'
     class='remove'></script>
    <script class='remove'>
      var respecConfig = ${JSON.stringify(node.respecConfig)};
    </script>
  </head>
  <body>
    ${emitNode("", node["vdoc:content"], document)}
  </body>
</html>
`;
}

function emitReVDocChapter (emission, node, document, emitNode, vdocson, emitters) {
  return ontology.emitters.html["vdoc:Chapter"](
      emission, Object.assign({}, node, { "vdoc:element": "section" }),
      document, emitNode, vdocson, emitters);
}
