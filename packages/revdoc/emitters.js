const { extension: vdocExtension } = require("@valos/vdoc");

module.exports = {
  html: {
    "vdoc:Document": emitReVDocHTML,
    "revdoc:Document": emitReVDocHTML,
    "vdoc:Chapter": emitReVDocChapter,
    "vdoc:Reference": emitReVDocReference,
  },
};

function emitReVDocHTML (node, emission, stack) {
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
    ${[].concat((stack.revdoc || {}).stylesheets || []).map(stylesheet =>
    `<link rel = "stylesheet" type = "text/css" href = "${stylesheet}" />
    `).join()}
  </head>
  <body>
    ${stack.emitNode(node["vdoc:content"], "")}
  </body>
</html>
`;
}

function emitReVDocChapter (node, emission, stack) {
  return vdocExtension.emitters.html["vdoc:Chapter"](
      Object.assign({}, node, { "vdoc:element": "section" }), emission, stack);
}

function emitReVDocReference (node, emission, stack) {
  let node_ = node;
  let ref = node_["vdoc:ref"];
  if ((ref != null) && (typeof ref !== "string")) {
    node_ = { ...node, "vdoc:ref": ref = stack.emitNode(node_["vdoc:ref"], "") };
  }
  if ((ref || "")[0] === "@") {
    const refParts = ref.match(/^([^/#]*)\/([^/#]*)\/?(#?.*)?$/);
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
  return vdocExtension.emitters.html["vdoc:Reference"](node_, emission, stack);
}
