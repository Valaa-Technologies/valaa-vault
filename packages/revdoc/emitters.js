const path = require("path");
const { extension: vdocExtension } = require("@valos/vdoc");

module.exports = {
  html: {
    "vdoc:Document": emitReVDocHTML,
    "revdoc:Document": emitReVDocHTML,
    "vdoc:Chapter": emitReVDocChapter,
    "vdoc:Reference": emitReVDocReference,
  },
};

function emitReVDocHTML (emission, node, document, emitNode /* , vdocld, extensions */) {
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

function emitReVDocChapter (emission, node, document, emitNode, vdocld, extensions) {
  return vdocExtension.emitters.html["vdoc:Chapter"](
      emission, Object.assign({}, node, { "vdoc:element": "section" }),
      document, emitNode, vdocld, extensions);
}

function emitReVDocReference (emission, node, document, emitNode, vdocld, extensions) {
  let node_ = node;
  if ((node["vdoc:ref"] || "")[0] === "@") {
    const nodePath = node["vdoc:ref"].match(/([^/#]*)\/([^/#]*)(.*)/);
    const packageName = nodePath.slice(1, 3).join("/");
    const packageJSON = require(`${packageName}/package.json`);
    const docsBase = (packageJSON.valos || {}).docs || packageName;
    node_ = Object.assign({}, node, {
      "vdoc:ref": path.posix.join(docsBase, ...nodePath.slice(3)),
    });
  }
  return vdocExtension.emitters.html["vdoc:Reference"](
      emission, node_, document, emitNode, vdocld, extensions);
}
