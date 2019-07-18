const path = require("path");
const { ontology } = require("@valos/type-vault/vdoc");

module.exports = {
  prefix: "revdoc",
  base: "https://valaatech.github.io/vault/type-vault/revdoc#",

  prefixes: {
    revdoc: "https://valaatech.github.io/vault/type-vault/revdoc#",
  },
  context: {
  },
  vocabulary: {
    Document: { a: "rdfs:Class", "rdfs:subClassOf": "vdoc:Chapter",
      "rdfs:comment": "A ReSpec specification document",
    },
    Definition: { a: "rdfs:Class", "rdfs:subClassOf": "vdoc:Node",
      "rdfs:comment": "A ReSpec term definition document node",
    },
    Package: { a: "rdfs:Class", "rdfs:subClassOf": "vdoc:Reference",
      "rdfs:comment": "A package reference document node",
    },
    Command: { a: "rdfs:Class", "rdfs:subClassOf": "vdoc:Node",
      "rdfs:comment": "A command invokation document node",
    },
    CommandLineInteraction: { a: "rdfs:Class", "rdfs:subClassOf": "vdoc:Node",
      "rdfs:comment": "A command line interaction sequence document node",
    },
  },
  extractionRules: {
    ontology: {
      range: "vdoc:Chapter", target: "vdoc:content", rest: "dc:title",
      comment: "Ontology specification chapter",
    },
  },
  extracteeAPI: {},
  extractor: {
    postExtend (target, /* patch, key, targetObject, patchObject */) {
      if (target && (this.keyPath.length === 1) && !target["rdf:type"]) {
        target["rdf:type"] = "revdoc:Document";
      }
    },
  },
  emitters: {
    html: {
      "vdoc:Document": emitReVDocHTML,
      "revdoc:Document": emitReVDocHTML,
      "vdoc:Chapter": emitReVDocChapter,
      "vdoc:Reference": emitReVDocReference,
    },
  },
};

function emitReVDocHTML (emission, node, document, emitNode /* , vdocson, emitters */) {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset='utf-8'>
    <title>${node["dc:title"]}</title>
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

function emitReVDocReference (emission, node, document, emitNode, vdocson, emitters) {
  let node_ = node;
  if ((node["vdoc:ref"] || "")[0] === "@") {
    const nodePath = node["vdoc:ref"].split("/");
    const packageName = nodePath.slice(0, 2).join("/");
    const packageJSON = require(`${packageName}/package.json`);
    const docsBase = (packageJSON.valos || {}).docs || packageName;
    node_ = Object.assign({}, node, {
      "vdoc:ref": path.posix.join(docsBase, ...nodePath.slice(2)),
    });
  }
  return ontology.emitters.html["vdoc:Reference"](
      emission, node_, document, emitNode, vdocson, emitters);
}
