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

function emitBreakHTML (emission /* , node, document, emitNode, vdocson, extensions */) {
  return `${emission}<br>`;
}

function emitValueHTML (emission, value /* , document, emitNode, vdocson, extensions */) {
  return `${emission}${value}`;
}

function emitNodeHTML (emission, node, document, emitNode /* , vdocson, extensions */) {
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

function emitArrayHTML (emission, content, document, emitNode, vdocson, extensions) {
  let paragraphBegin = 0;
  let ret = emission;
  for (let i = 0; i <= content.length; ++i) {
    if (i < content.length ? (content[i] === null) : paragraphBegin) {
      if (i > paragraphBegin) {
        const body = emitArrayHTML("", content.slice(paragraphBegin, i),
            document, emitNode, vdocson, extensions);
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

function emitChapterHTML (emission, node, document, emitNode, vdocson, extensions) {
  return emitNodeHTML(emission, node, document, emitNode, vdocson, extensions);
}

function emitBulletListHTML (emission, node, document, emitNode /* , vdocson, extensions */) {
  let lis = "";
  for (const entry of (node["vdoc:entries"] || [])) {
    lis += `      <li>${emitNode("", entry, document)}</li>\n`;
  }
  return `${emission}\n    <ul>\n${lis}    </ul>\n`;
}

function emitNumberedListHTML (emission, node, document, emitNode /* , vdocson, extensions */) {
  let lis = "";
  for (const entry of (node["vdoc:entries"] || [])) {
    lis += `      <li>${emitNode("", entry, document)}</li>\n`;
  }
  return `${emission}\n    <ol>\n${lis}    </ol>\n`;
}

function emitTableHTML (emission, node, document, emitNode /* , vdocson, extensions */) {
  const keys = [];
  const headers = [];
  if (!node["vdoc:headers"]) {
    throw new Error("vdoc:Table is missing headers");
  }
  for (const header of node["vdoc:headers"]) {
    keys.push(header["vdoc:key"]);
    const headerText = emitNode("", header["vdoc:content"], document);
    headers.push(`<th${emitAttributes(header)}>${headerText}</th>`);
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
    for (const key of keys) {
      if (key === "vdoc:id") id = entryKey;
      entryText += `<td>${(key === "vdoc:key") || (key === "vdoc:id") ? entryKey
          : emitNode("",
              (key === "vdoc:value") ? entryData : (entryData != null) && entryData[key],
              document)
      }</td>`;
    }
    entryTexts.push(`<tr${id ? ` id="${id}"` : ""}>${entryText}</tr>`);
  }
  return `${emission}
    <table${emitAttributes(node)}>
      <thead>
        ${headers.join(`
        `)}
      </thead>
      <tbody>
        ${entryTexts.join(`
        `)}
      </tbody>
    </table>
`;
}

function emitReferenceHTML (emission, node, document, emitNode /* , vdocson, extensions */) {
  const head = `${emission}<a href="${node["vdoc:ref"]}"${emitAttributes(node)}`;
  return node["vdoc:content"]
      ? `${head}>${emitNode("", node["vdoc:content"], document)}</a>`
      : `${head} />`;
}
