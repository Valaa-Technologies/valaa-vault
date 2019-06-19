// @flow

const { ontology } = require("~/toolset-vault/vdoc");

module.exports = {
  prefixes: {
    revdoc: "http://valospace.org/revdoc#",
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
      "revdoc:Document": emitReVDocHTML,
      "vdoc:Chapter": emitReVDocChapter,
    },
  }
};

function emitReVDocHTML (emission, node, document, emitNode /* , vsonldoc, emitters */) {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset='utf-8'>
    <title>${node.title}</title>
    <script
     src='https://www.w3.org/Tools/respec/respec-w3c-common'
     class='remove'></script>
    <script class='remove'>
      var respecConfig = ${JSON.stringify(node.respecConfig)};
    </script>
  </head>
  <body>
    ${emitNode("", node["vdoc:entries"], document)}
  </body>
</html>
`;
}

function emitReVDocChapter (emission, node, document, emitNode, vsonldoc, emitters) {
  return ontology.emitters.html["vdoc:Chapter"](
      emission, Object.assign({}, node, { "vdoc:element": "section" }),
      document, emitNode, vsonldoc, emitters);
}
