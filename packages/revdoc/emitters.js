const { extension: vdocExtension } = require("@valos/vdoc");
const { wrapError, dumpObject } = require("@valos/tools/wrapError");
const { tooltip } = require("@valos/revdoc/extractee");
const { obtainFullVocabulary } = require("@valos/revdoc/ontologyNamespace");

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
      ref = (!subPath || (subPath[0] === "#") || (docsBase[docsBase.length - 1] === "/"))
          ? `${docsBase}${subPath}`
          : `${docsBase}/${subPath}`;
    } else {
      const [prefix, ...suffixes] = (ref || "").split(":");
      const contextEntry = !suffixes.length ? undefined : stack.document["@context"][prefix];
      if (contextEntry != null) {
        const expansion = (typeof contextEntry === "string") ? contextEntry : contextEntry["@id"];
        if (expansion != null) {
          ref = `${expansion}${suffixes.join(":")}`; // TODO: unescape suffix escapes
        } else {
          stack.error("Unable to expand reference:", ref, "from @context entry:", contextEntry);
        }
      } else if (suffixes.length && (prefix[0] === "V") && prefix[1].toLowerCase() !== prefix[1]) {
        stack.error(`Can't find valos namespace '${prefix}' definition in @context`,
            `when trying to resolve reference`, ref);
      }
    }
    if (ref !== node["VDoc:ref"]) {
      node_ = Object.assign({}, node, { "VDoc:ref": ref || null });
    }
    const refIndex = ref.indexOf("#") + 1;
    const refBase = ref.slice(0, refIndex);
    const referencedModule = (stack.document["VRevdoc:referencedModules"] || {})[refBase];
    if (referencedModule) {
      const term = ref.slice(refIndex);
      const definition = obtainFullVocabulary(referencedModule)[term];
      if (!definition) {
        stack.error(
            `Can't find term '${term}' definition in module "${referencedModule}" vocabulary`,
            `when trying to resolve namespaced reference ${node["VDoc:ref"]}`);
      } else if (definition["rdfs:comment"]) {
        if (node === node_) node_ = { ...node };
        node_["VDoc:content"] = [tooltip(node_["VDoc:content"], definition["rdfs:comment"])];
      }
    }
    const ret = vdocExtension.emitters.html["VDoc:Reference"](node_, emission, stack);
    return ret;
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
  return `${emission}<span class="vdoc type-revdoc-tooltip">
    ${stack.emitNode({ ...node, "@type": "VDoc:Node" }, "")}
    <span class="vdoc type-revdoc-tooltip-content">
        ${stack.emitNode(node["VRevdoc:tooltipContent"], "")}
    </span>
</span>`;
}
