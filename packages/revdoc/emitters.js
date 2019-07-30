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
    const refParts = node["vdoc:ref"].match(/^([^/#]*)\/([^/#]*)\/?(#?.*)?$/);
    const packageName = (refParts[1] === "@")
        ? refParts[2]
        : refParts.slice(1, 3).join("/");
    const packageJSON = require(`${packageName}/package`);
    const docsBase = (packageJSON.valos || {}).docs || packageName;
    const subPath = refParts[3] || "";
    node_ = Object.assign({}, node, {
      "vdoc:ref": (!refParts[3] || (subPath[0] === "#") || (docsBase[docsBase.length - 1] === "/"))
          ? `${docsBase}${refParts[3] || ""}`
          : `${docsBase}/${refParts[3]}`,
    });
  }
  return vdocExtension.emitters.html["vdoc:Reference"](
      emission, node_, document, emitNode, vdocld, extensions);
}
