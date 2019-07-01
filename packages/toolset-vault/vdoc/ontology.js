
const extractionRuleRegex = /([^#]*)#(([0-9]+)|([^#>;]+))?(>([0-9]+)|([^#>;]*))?(;([^#>;]*))?/;

module.exports = {
  prefix: "vdoc",
  base: "https://valaatech.github.io/vault/toolset-vault/vdoc#",

  prefixes: {
    dc: "http://purl.org/dc/elements/1.1/",
    owl: "http://www.w3.org/2002/07/owl#",
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
    vdoc: "https://valaatech.github.io/vault/toolset-vault/vdoc#",
  },

  context: {
    a: { "@id": "rdf:type", "@type": "@id" },
    "vdoc:content": {
      "@id": "https://valaatech.github.io/vault/toolset-vault/vdoc#content", "@container": "@list",
    },
    "vdoc:words": {
      "@id": "https://valaatech.github.io/vault/toolset-vault/vdoc#words", "@container": "@list",
    },
    "vdoc:rows": {
      "@id": "https://valaatech.github.io/vault/toolset-vault/vdoc#rows", "@container": "@list",
    },
  },

  vocabulary: {
    Node: { a: "rdfs:Class",
      "rdfs:comment": "A document tree Node",
    },
    content: { a: "rdf:Property",
      "rdfs:domain": "vdoc:Node", "rdfs:range": "rdfs:List",
      "rdfs:comment": "The primary visible content of a Node",
    },
    words: { a: "rdf:Property", "rdfs:subPropertyOf": "vdoc:content",
      "rdfs:domain": "vdoc:Node", "rdfs:range": "rdfs:List",
      "rdfs:comment": "A visible list of visually separate words",
    },
    rows: { a: "rdf:Property", "rdfs:subPropertyOf": "vdoc:content",
      "rdfs:domain": "vdoc:Node", "rdfs:range": "rdfs:List",
      "rdfs:comment": "A visible list of vertically stacked rows",
    },
    title: { a: "rdf:Property", "rdfs:domain": "vdoc:Node", "rdfs:range": "rdfs:Resource",
      "rdfs:comment": "Human readable name of a Node",
    },
    Chapter: { a: "rdfs:Class", "rdfs:subClassOf": "vdoc:Node",
      "rdfs:comment": "A titled, possibly numbered chapter document node",
    },
    BulletList: { a: "rdfs:Class", "rdfs:subClassOf": "vdoc:Node",
      "rdfs:comment": "A bullet list document node",
    },
    NumberedList: { a: "rdfs:Class", "rdfs:subClassOf": "vdoc:Node",
      "rdfs:comment": "A numbered list document node",
    },
    Table: { a: "rdfs:Class", "rdfs:subClassOf": "vdoc:Node",
      "rdfs:comment": "A two-dimensional table document node",
    },
    CharacterData: { a: "rdfs:Class", "rdfs:subClassOf": "vdoc:Node",
      "rdfs:comment": "A CDATA document node",
    },
    Reference: { a: "rdfs:Class", "rdfs:subClassOf": "vdoc:Node",
      "rdfs:comment": "A reference document node",
    },
    ContextPath: { a: "rdfs:Class", "rdfs:subClassOf": "vdoc:Node",
      "rdfs:comment": "A context-based path document node",
    },
    context: { a: "rdf:Property", "rdfs:domain": "vdoc:ContextPath", "rdfs:range": "rdfs:Resource",
      "rdfs:comment": "Non-visible context base (absolute or relative to current base)",
    },
    ContextBase: { a: "rdfs:Class", "rdfs:subClassOf": "vdoc:ContextPath",
      "rdfs:comment": "A context base setting document node",
    },
  },

  extractionRules: {
    "": {
      comment: "Basic Node", target: "vdoc:content",
    },
    chapter: {
      range: "vdoc:Chapter", target: "vdoc:content", rest: "vdoc:title",
      comment: "Numbered, titled chapter",
    },
    bulleted: {
      range: "vdoc:BulletList", target: "vdoc:rows",
      comment: "Bulleted list",
    },
    numbered: {
      range: "vdoc:NumberedList", target: "vdoc:rows",
      comment: "Numbered list",
    },
    table: {
      range: "vdoc:Table", target: "vdoc:columns", rest: "vdoc:lookup",
      comment: "Table",
    },
    column: {
      range: "vdoc:Column", target: "vdoc:content", rest: "vdoc:key",
      comment: "Column",
    },
    data: {
      hidden: true, target: "vdoc:content",
      comment: "Data lookup",
    },
  },

  extracteeAPI: {},

  extractor: {
    preExtend (target, patch, key, targetObject /* , patchObject */) {
      if (typeof key !== "string") return undefined;
      const [match, ruleName,, elementId, resourceId,, orderElement, orderId,, rest] =
          key.match(extractionRuleRegex) || [];
      if (!match) return undefined;
      const rule = module.exports.extractionRules[ruleName];
      if (!rule) return undefined;
      let node = (resourceId === undefined) ? {}
          : (this.documentNode[resourceId]
              || (this.documentNode[resourceId] = { "@id": resourceId }));
      if (rest !== undefined) {
        if (!rule.rest) {
          throw new Error(`Rule '${ruleName}' doesn't specify 'rest' but '${rest}' was found`);
        }
        if (node[rule.rest] !== undefined) {
          throw new Error(`Node #${resourceId || elementId} already has '${rule.rest}': ${
            JSON.stringify(node[rule.rest])}`);
        }
        node[rule.rest] = rest;
      }
      if (rule.range) node["rdf:type"] = rule.range;
      if (typeof patch !== "object") {
        if (!resourceId && !Object.keys(node).length) {
          node = patch;
        } else {
          node[rule.target] = this.extend([], [patch]);
        }
      } else if (Array.isArray(patch)) {
        if (rule.hidden || (!resourceId && !Object.keys(node).length)) {
          node = this.extend([], patch);
          if (resourceId) this.documentNode[resourceId] = node;
        } else {
          node[rule.target] = this.extend([], patch);
        }
      } else {
        node["vdoc:pre_target"] = rule.target;
        this.extend(node, patch);
        delete node["vdoc:pre_target"];
      }
      if (!rule.hidden) {
        (targetObject["vdoc:pre_content"] || (targetObject["vdoc:pre_content"] = [])).push([
          (orderId && `${orderId}\uFFFF`) || (orderElement && (Number(orderElement) + 0.5))
              || resourceId || (elementId && Number(elementId)),
          resourceId ? { "@id": resourceId } : node,
        ]);
      }
      return null;
    },
    postExtend (target) {
      const unorderedEntries = (target != null) && target["vdoc:pre_content"];
      if (unorderedEntries) {
        target[target["vdoc:pre_target"] || "vdoc:content"] = []
            .concat(...unorderedEntries.sort(_compareWithOrderQualifier).map(e => e[1]));
        delete target["vdoc:pre_content"];
      }
    },
  },

  emitters: {
    html: {
      null: emitBreakHTML,
      string: emitValueHTML,
      number: emitValueHTML,
      array: emitArrayHTML,
      object: emitNodeHTML,
      "vdoc:Node": emitNodeHTML,
      "vdoc:Chapter": emitChapterHTML,
      "vdoc:BulletList": emitBulletListHTML,
      "vdoc:NumberedList": emitNumberedListHTML,
      "vdoc:Table": emitTableHTML,
      "vdoc:Reference": emitReferenceHTML,
    },
  },
};

function _compareWithOrderQualifier (l, r) {
  return (l[0] < r[0]) ? -1 : (l[0] > r[0]) ? 1 : 0;
}

function emitBreakHTML (emission /* , node, document, emitNode, vdocson, emitters */) {
  return `${emission}<br>`;
}

function emitValueHTML (emission, value /* , document, emitNode, vdocson, emitters */) {
  return `${emission}${value}`;
}

function emitNodeHTML (emission, node, document, emitNode /* , vdocson, emitters */) {
  let body = "";
  if (node["vdoc:title"]) {
    body += `\n    <h2>${node["vdoc:title"]}</h2>\n`;
  }
  const content = node["vdoc:content"]
      || (node["vdoc:words"] && [].concat(...node["vdoc:words"]
          .map((word, index) => (!index ? [word] : [" ", word]))))
      || (node["vdoc:rows"] && [].concat(...node["vdoc:rows"]
          .map((line, index) => (!index ? [line] : [null, line]))))
      || (node["@id"] && document[node["@id"]]);
  if (content) {
    body += emitNode("", content, document);
    const attributes = emitAttributes(node);
    if (node["vdoc:element"] || attributes) {
      const elem = node["vdoc:element"] || (node["vdoc:rows"] ? "div" : "span");
      body = (elem === "span") ? `<${elem}${attributes}>${body}</${elem}>\n` : `
  <${elem}${attributes}>${body}
  </${elem}>\n`;
    }
  }
  return `${emission}${body}`;
}

function emitAttributes (node) {
  let ret = "";
  let typeClasses = node["vdoc:class"] || "";
  if (node["rdf:type"]) {
    if (node["@id"]) ret += ` id="${node["@id"]}"`;
    typeClasses += `vdoc type-${_classify(node["rdf:type"])}`;
  }
  if (typeClasses) ret += ` class="${typeClasses}"`;
  if (node["vdoc:style"]) ret += ` style="${node["vdoc:style"]}"`;
  return ret;
}

function _classify (typeString) {
  return typeString.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase().split(":").join("-");
}

function emitArrayHTML (emission, content, document, emitNode, vdocson, emitters) {
  let paragraphBegin = 0;
  let ret = emission;
  for (let i = 0; i <= content.length; ++i) {
    if (i < content.length ? (content[i] === null) : paragraphBegin) {
      if (i > paragraphBegin) {
        const body = emitArrayHTML("", content.slice(paragraphBegin, i),
            document, emitNode, vdocson, emitters);
        ret += ((i === content.length) && !paragraphBegin)
            ? body
            : `      <p>${body}</p>\n`;
      }
      paragraphBegin = i + 1;
    }
  }
  if (paragraphBegin) return ret;
  let listitems = "";
  for (const entry of content) listitems += emitNode("", entry, document);
  return `${ret}${listitems}`;
}

function emitChapterHTML (emission, node, document, emitNode, vdocson, emitters) {
  return emitNodeHTML(emission, node, document, emitNode, vdocson, emitters);
}

function emitBulletListHTML (emission, node, document, emitNode /* , vdocson, emitters */) {
  let lis = "";
  for (const entry of (node["vdoc:rows"] || [])) {
    lis += `      <li>${emitNode("", entry, document)}</li>\n`;
  }
  return `${emission}\n    <ul>\n${lis}    </ul>\n`;
}

function emitNumberedListHTML (emission, node, document, emitNode /* , vdocson, emitters */) {
  let lis = "";
  for (const entry of (node["vdoc:rows"] || [])) {
    lis += `      <li>${emitNode("", entry, document)}</li>\n`;
  }
  return `${emission}\n    <ol>\n${lis}    </ol>\n`;
}

function emitTableHTML (emission, node, document, emitNode /* , vdocson, emitters */) {
  const keys = [];
  const headers = [];
  if (!node["vdoc:columns"]) {
    throw new Error("vdoc:Table missing columns");
  }
  for (const column of node["vdoc:columns"]) {
    keys.push(column["vdoc:key"]);
    const headerText = emitNode("", column["vdoc:content"], document);
    headers.push(`<th${emitAttributes(column)}>${headerText}</th>`);
  }
  const rowTexts = [];
  const lookup = (typeof node["vdoc:lookup"] !== "string") ? node["vdoc:lookup"]
      : document[node["vdoc:lookup"]];
  const rows = !node["vdoc:rows"]
      ? Object.entries(lookup || {})
      : node["vdoc:rows"].map((row, index) =>
          (!lookup || (typeof row === "object") ? [index, row] : [row, lookup[row]]));
  for (const [rowKey, rowData] of rows) {
    if (rowKey === "@id") continue;
    let rowText = "";
    for (const key of keys) {
      rowText += `<td>${(key === "vdoc:key") ? rowKey
          : emitNode("",
              (key === "vdoc:value") ? rowData : (rowData != null) && rowData[key],
              document)
      }</td>`;
    }
    rowTexts.push(`<tr>${rowText}</tr>`);
  }
  return `${emission}
    <table${emitAttributes(node)}>
      <thead>
        ${headers.join(`
        `)}
      </thead>
      <tbody>
        ${rowTexts.join(`
        `)}
      </tbody>
    </table>
`;
}

function emitReferenceHTML (emission, node, document, emitNode /* , vdocson, emitters */) {
  const head = `${emission}<a href="${node["vdoc:ref"]}"${emitAttributes(node)}`;
  return node["vdoc:content"]
      ? `${head}>${emitNode("", node["vdoc:content"], document)}</a>`
      : `${head} />`;
}
