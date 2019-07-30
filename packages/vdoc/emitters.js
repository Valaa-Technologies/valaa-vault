const patchWith = require("@valos/tools/patchWith").default;

module.exports = {
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
};

function emitBreakHTML (emission /* , node, document, emitNode, vdocld, extensions */) {
  return `${emission}<br>`;
}

function emitValueHTML (emission, value /* , document, emitNode, vdocld, extensions */) {
  return `${emission}${value}`;
}

function emitNodeHTML (emission, node, document, emitNode /* , vdocld, extensions */) {
  let body = "";
  if (node["dc:title"]) {
    body += `\n    <h2>${node["dc:title"]}</h2>\n`;
  }
  const content = node["vdoc:content"]
      || (node["vdoc:words"] && [].concat(...node["vdoc:words"]
          .map((word, index) => (!index ? [word] : [" ", word]))))
      || (node["vdoc:entries"] && [].concat(...node["vdoc:entries"]
          .map((line, index) => (!index ? [line] : [null, line]))))
      || (node["@id"] && document[node["@id"]]);
  if (content) {
    body += emitNode("", content, document);
    const attributes = emitAttributes(node);
    if (node["vdoc:element"] || attributes) {
      const elem = node["vdoc:element"] || (node["vdoc:entries"] ? "div" : "span");
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

function emitArrayHTML (emission, content, document, emitNode, vdocld, extensions) {
  let paragraphBegin = 0;
  let ret = emission;
  for (let i = 0; i <= content.length; ++i) {
    if (i < content.length ? (content[i] === null) : paragraphBegin) {
      if (i > paragraphBegin) {
        const body = emitArrayHTML("", content.slice(paragraphBegin, i),
            document, emitNode, vdocld, extensions);
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

function emitChapterHTML (emission, node, document, emitNode, vdocld, extensions) {
  return emitNodeHTML(emission, node, document, emitNode, vdocld, extensions);
}

function emitBulletListHTML (emission, node, document, emitNode /* , vdocld, extensions */) {
  let lis = "";
  for (const entry of (node["vdoc:entries"] || [])) {
    lis += `      <li>${emitNode("", entry, document)}</li>\n`;
  }
  return `${emission}\n    <ul>\n${lis}    </ul>\n`;
}

function emitNumberedListHTML (emission, node, document, emitNode /* , vdocld, extensions */) {
  let lis = "";
  for (const entry of (node["vdoc:entries"] || [])) {
    lis += `      <li>${emitNode("", entry, document)}</li>\n`;
  }
  return `${emission}\n    <ol>\n${lis}    </ol>\n`;
}

function emitTableHTML (emission, node, document, emitNode /* , vdocld, extensions */) {
  const cellContents = [];
  const wideRowContents = [];
  const headerTexts = [];
  let headers = node["vdoc:headers"];
  if (!headers) {
    throw new Error("vdoc:Table is missing headers");
  }
  if (!Array.isArray(headers)) {
    if (headers["vdoc:entries"]) headers = headers["vdoc:entries"];
    else throw new Error("vdoc:Table vdoc:headers is not an array nor doesn't have vdoc:entries");
  }
  for (const header of headers) {
    const headerText = emitNode("", header["vdoc:content"], document);
    if ([].concat(header["vdoc:layout"] || []).includes("vdoc:wide")) {
      wideRowContents.push({ headerText, cellContent: header["vdoc:cellContent"] });
    } else {
      cellContents.push(header["vdoc:cellContent"]);
      headerTexts.push(`<th${emitAttributes(header)}>${headerText}</th>`);
    }
  }
  const entryTexts = [];
  const lookup = (typeof node["vdoc:lookup"] !== "string") ? node["vdoc:lookup"]
      : document[node["vdoc:lookup"]];
  const entries = !node["vdoc:entries"]
      ? Object.entries(lookup || {})
      : node["vdoc:entries"].map((entry, index) =>
          (!lookup || (typeof entry === "object") ? [index, entry] : [entry, lookup[entry]]));
  for (const [entryKey, entryData] of entries) {
    if (entryKey === "@id") continue;
    let entryText = "";
    let id;
    for (const cellContent of cellContents) {
      if (cellContent === "vdoc:id") id = entryKey;
      entryText += `<td>${_generateCellText(cellContent, entryKey, entryData)}</td>`;
    }
    entryTexts.push(`<tr${id ? ` id="${id}"` : ""}>${entryText}</tr>`);
    for (const { headerText, cellContent } of wideRowContents) {
      entryTexts.push(`<tr><td style="vertical-align: top;">${headerText
        }</td><td colspan=${headers.length - 1 || 1
        }>${_generateCellText(cellContent, entryKey, entryData)}</td></tr>`);
    }
  }
  return `${emission}
    <table${emitAttributes(node)}>
      <thead>
        ${headerTexts.join(`
        `)}
      </thead>
      <tbody>
        ${entryTexts.join(`
        `)}
      </tbody>
    </table>
`;
  function _generateCellText (cellContent, entryKey, entryData) {
    const select = {
      "vdoc:selectKey": entryKey,
      "vdoc:id": entryKey,
      "vdoc:selectValue": entryData,
    };
    let entry;
    if (typeof cellContent === "string") {
      entry = select[cellContent];
      if (entry === undefined) entry = entryData[cellContent];
    } else {
      entry = patchWith({}, cellContent, {
        preExtend (tgt, patch) {
          if (typeof patch === "string") {
            return select[patch] !== undefined ? select[patch] : patch;
          }
          return undefined;
        },
      });
    }
    if (typeof entry !== "object") return entry;
    return emitNode("", entry, document);
  }
}

function emitReferenceHTML (emission, node, document, emitNode /* , vdocld, extensions */) {
  const head = `${emission}<a href="${node["vdoc:ref"]}"${emitAttributes(node)}`;
  return node["vdoc:content"]
      ? `${head}>${emitNode("", node["vdoc:content"], document)}</a>`
      : `${head} />`;
}
