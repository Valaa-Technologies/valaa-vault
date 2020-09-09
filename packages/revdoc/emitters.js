const { extension: vdocExtension } = require("@valos/vdoc");
const { wrapError, dumpObject } = require("@valos/tools/wrapError");

module.exports = {
  html: {
    "VDoc:Document": emitReVDocHTML,
    "VRevdoc:Document": emitReVDocHTML,
    "VDoc:Chapter": emitReVDocChapter,
    "VDoc:Reference": emitReVDocReference,
    "VRevdoc:Invokation": emitReVDocInvokation,
    "VRevdoc:Command": emitReVDocCommand,
    "VRevdoc:Example": emitReVDocExample,
    "VRevdoc:Tooltip": emitReVDocTooltip,
  },
};

function emitReVDocHTML (node, emission, stack) {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset='utf-8'>
    <title>${stack.emitNode(node["dc:title"], "")}</title>
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
  <body class="vdoc vdoc-body">
    ${stack.emitNode(node["VDoc:content"], "")}
  </body>
</html>
`;
}

function emitReVDocChapter (node, emission, stack) {
  return vdocExtension.emitters.html["VDoc:Chapter"](Object.assign({}, node, {
    "VDoc:element": "section",
    "VDoc:content": (node["VDoc:content"] || []).map(e => ((typeof e !== "string")
        ? e
        : { "@type": "VDoc:Node", "VDoc:element": "span", "VDoc:content": [e] })),
  }), emission, stack);
}

const _referencePackageMatcher = /^(@[^/#]*)\/([^/#]*)\/?(#?.*)?$/;

function emitReVDocReference (node, emission, stack) {
  try {
    let ref = node["VDoc:ref"];
    let node_ = node;
    if ((ref != null) && (typeof ref !== "string")) {
      ref = stack.emitNode(ref, "");
    }
    const refParts = (ref || "").match(_referencePackageMatcher);
    if (refParts) {
      const packageName = (refParts[1] === "@")
          ? refParts[2]
          : refParts.slice(1, 3).join("/");
      let packageJSON;
      try {
        packageJSON = require(`${packageName}/package`);
      } catch (error) {
        packageJSON = {};
      }
      const docsBase = (packageJSON.valos || {}).docs || packageName;
      const subPath = refParts[3] || "";
      ref = (!refParts[3] || (subPath[0] === "#")
              || (docsBase[docsBase.length - 1] === "/"))
          ? `${docsBase}${refParts[3] || ""}`
          : `${docsBase}/${refParts[3]}`;
    } else {
      const [prefix, ...suffixes] = (ref || "").split(":");
      const contextEntry = !suffixes.length ? undefined : stack.document["@context"][prefix];
      if (contextEntry != null) {
        const expansion = (typeof contextEntry === "string") ? contextEntry : contextEntry["@id"];
        if (expansion != null) {
          ref = `${expansion}${suffixes.join(":")}`; // TODO: unescape suffix escapes
        } else {
          console.log("Unable to expand reference:", ref, "from context entry:", contextEntry);
        }
      }
    }
    if (ref !== node["VDoc:ref"]) {
      node_ = Object.assign({}, node, { "VDoc:ref": ref || null });
    }
    return vdocExtension.emitters.html["VDoc:Reference"](node_, emission, stack);
  } catch (error) {
    throw wrapError(error, new Error("During emitReVDocReference, with:"),
        "\n\tnode:", ...dumpObject(node, { nest: true }));
  }
}

function emitReVDocInvokation (node, emission, stack) {
  return `${emission}<code>${
    stack.emitNode({ ...node, "@type": "VDoc:Node" }, "")
  }</code>`;
}

function emitReVDocCommand (node, emission, stack) {
  return `${emission}<strong><em class="vdoc type-revdoc-command">${
    stack.emitNode({ ...node, "@type": "VDoc:Node" }, "")
  }</em></strong>`;
}

function emitReVDocExample (node, emission, stack) {
  return `${emission}
<blockquote class="vdoc type-revdoc-example">
    ${stack.emitNode({ ...node, "@type": "VDoc:Node" }, "")}
</blockquote>`;
}

function emitReVDocTooltip (node, emission, stack) {
  return `${emission}<div class="vdoc type-revdoc-tooltip">
    ${stack.emitNode({ ...node, "@type": "VDoc:Node" }, "")}
    <span class="vdoc type-revdoc-tooltip-content">
        ${stack.emitNode(node["VRevdoc:tooltipContent"], "")}
    </span>
</div>`;
}
