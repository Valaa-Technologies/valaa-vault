
const extractionRuleRegex = /([^#]*)#(([0-9]+)|([^#>;]+))?(>([0-9]+)|([^#>;]*))?(;([^#>;]*))?/;

module.exports = {
  prefixes: {
    dc: "http://purl.org/dc/elements/1.1/",
    owl: "http://www.w3.org/2002/07/owl#",
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
    vdoc: "http://valospace.org/vdoc#",
  },

  context: {
    a: { "@id": "rdf:type", "@type": "@id" },
    "vdoc:entries": { "@id": "http://valospace.org/vdoc#entries", "@container": "@list" },
  },

  vocabulary: {
    Node: { a: "rdfs:Class" },
    title: { a: "rdf:Property", "rdf:domain": "vdoc:Node", "rdf:range": "rdfs:Literal" },
    entries: { a: "rdf:Property", "rdf:domain": "vdoc:Node", "rdf:range": "rdf:List" },
    Chapter: { a: "rdfs:Class", "rdfs:subClassOf": "vdoc:Node" },
    BulletList: { a: "rdfs:Class", "rdfs:subClassOf": "vdoc:Node" },
    NumberedList: { a: "rdfs:Class", "rdfs:subClassOf": "vdoc:Node" },
    Table: { a: "rdfs:Class", "rdfs:subClassOf": "vdoc:Node" },
    Reference: { a: "rdfs:Class", "rdfs:subClassOf": "vdoc:Node" },
  },

  extractionRules: {
    "": {
      comment: "Basic Node",
    },
    chapter: {
      range: "vdoc:Chapter", rest: "vdoc:title",
      comment: "Numbered, titled chapter",
    },
    bulleted: {
      range: "vdoc:BulletList",
      comment: "Bulleted list",
    },
    numbered: {
      range: "vdoc:NumberedList",
      comment: "Numbered list",
    },
    table: {
      range: "vdoc:Table", rest: "vdoc:data",
      comment: "Table",
    },
    column: {
      range: "vdoc:Column", rest: "vdoc:key",
      comment: "Column",
    },
    data: {
      hidden: true,
      comment: "Data lookup",
    },
    ontology: {
      range: "vdoc:Chapter", rest: "vdoc:title",
      comment: "Ontology specification chapter",
    },
  },

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
          node["vdoc:entries"] = this.extend([], [patch]);
        }
      } else if (Array.isArray(patch)) {
        if (!resourceId && !Object.keys(node).length) {
          node = this.extend([], patch);
        } else {
          node["vdoc:entries"] = this.extend([], patch);
        }
      } else {
        this.extend(node, patch);
      }
      if (!rule.hidden) {
        (targetObject["vdoc:pre_entries"] || (targetObject["vdoc:pre_entries"] = [])).push([
          (orderId && `${orderId}\uFFFF`) || (orderElement && (Number(orderElement) + 0.5))
              || resourceId || (elementId && Number(elementId)),
          resourceId ? { "@id": resourceId } : node,
        ]);
      }
      return null;
    },
    postExtend (target) {
      const unorderedEntries = (target != null) && target["vdoc:pre_entries"];
      if (unorderedEntries) {
        target["vdoc:entries"] = []
            .concat(...unorderedEntries.sort(_compareWithOrderQualifier).map(e => e[1]));
        delete target["vdoc:pre_entries"];
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
      "vdoc:Chapter": emitNodeHTML, // emitChapterHTML,
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

function emitBreakHTML (emission /* , node, document, emitNode, vsonldoc, emitters */) {
  return `${emission}<br>`;
}

function emitValueHTML (emission, value /* , document, emitNode, vsonldoc, emitters */) {
  return `${emission} ${value} `;
}

function emitNodeHTML (emission, node, document, emitNode /* , vsonldoc, emitters */) {
  let body = "";
  if (node["vdoc:title"]) {
    body += `\n    <h2>${node["vdoc:title"]}</h2>\n`;
  }
  const entries = node["vdoc:entries"]
      || (node["@id"] && document[node["@id"]]);
  if (entries) {
    body += emitNode("", entries, document);
    const attributes = emitAttributes(node);
    if (node["vdoc:element"] || attributes) {
      const elem = node["vdoc:element"] || "div";
      body = `
  <${elem}${attributes}>${body}
  </${elem}>\n`;
    }
  }
  return `${emission}${body}`;
}

function emitAttributes (node) {
  let ret = "";
  if (node["@id"] && node["rdf:type"]) ret += ` id="${node["@id"]}"`;
  if (node["vdoc:style"]) ret += ` style="${node["vdoc:style"]}"`;
  if (node["vdoc:class"]) ret += ` class="${node["vdoc:class"]}"`;
  return ret;
}

function emitArrayHTML (emission, entries, document, emitNode, vsonldoc, emitters) {
  let paragraphBegin = 0;
  let ret = emission;
  for (let i = 0; i <= entries.length; ++i) {
    if (i < entries.length ? !entries[i] : paragraphBegin) {
      if (i > paragraphBegin) {
        ret += `      <p>${emitArrayHTML(
            "", entries.slice(paragraphBegin, i), document, emitNode, vsonldoc, emitters)
        }</p>\n`;
      }
      paragraphBegin = i + 1;
    }
  }
  if (paragraphBegin) return ret;
  let lis = "";
  for (const entry of entries) lis += emitNode("", entry, document);
  return `${ret}${lis}`;
}

// function emitChapterHTML (emission, node, document, emitNode /* , vsonldoc, emitters */) {}

function emitBulletListHTML (emission, node, document, emitNode /* , vsonldoc, emitters */) {
  let lis = "";
  for (const entry of (node["vdoc:entries"] || [])) {
    lis += `      <li>${emitNode("", entry, document)}</li>\n`;
  }
  return `${emission}\n    <ul>\n${lis}    </ul>\n`;
}

function emitNumberedListHTML (emission, node, document, emitNode /* , vsonldoc, emitters */) {
  let lis = "";
  for (const entry of (node["vdoc:entries"] || [])) {
    lis += `      <li>${emitNode("", entry, document)}</li>\n`;
  }
  return `${emission}\n    <ol>\n${lis}    </ol>\n`;
}

function emitTableHTML (emission, node, document, emitNode /* , vsonldoc, emitters */) {
  const keys = [];
  const headers = [];
  for (const header of node["vdoc:entries"]) {
    keys.push(header["vdoc:key"]);
    headers.push(`<th${emitAttributes(header)}>${
      emitNode("", header["vdoc:entries"], document)
    }</th>`);
  }
  const rows = [];
  const data = (typeof node["vdoc:data"] === "string")
      ? document[node["vdoc:data"]] : node["vdoc:data"];
  for (const [rowKey, rowData] of Object.entries(data || {})) {
    if (rowKey === "@id") continue;
    let row = "";
    for (const key of keys) {
      row += `<td>${(key === "vdoc:key") ? rowKey
          : emitNode("",
              (key === "vdoc:value") ? rowData : (rowData != null) && rowData[key],
              document)
      }</td>`;
    }
    rows.push(`<tr>${row}</tr>`);
  }
  return `${emission}
    <table${emitAttributes(node)}>
      <thead>
        ${headers.join(`
        `)}
      </thead>
      <tbody>
        ${rows.join(`
        `)}
      </tbody>
    </table>
`;
}

function emitReferenceHTML (emission, node, document, emitNode /* , vsonldoc, emitters */) {
  const head = `${emission}<a href="${node["vdoc:ref"]}"${emitAttributes(node)}`;
  return node["vdoc:entries"]
      ? `${head}>${emitNode("", node["vdoc:entries"], document)}</a>`
      : `${head} />`;
}
