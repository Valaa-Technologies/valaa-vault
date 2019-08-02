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

function emitBreakHTML (node, emission) {
  return `${emission}<br>`;
}

function emitValueHTML (value, emission) {
  return `${emission}${value}`;
}

function emitNodeHTML (node, emission, stack) {
  let body = "";
  if (node["dc:title"]) {
    body += `\n    <h2>${node["dc:title"]}</h2>\n`;
  }
  const content = node["vdoc:content"]
      || (node["vdoc:words"] && [].concat(...[].concat(node["vdoc:words"] || [])
          .map((word, index) => (!index ? [word] : [" ", word]))))
      || (node["vdoc:entries"] && [].concat(...[].concat(node["vdoc:entries"] || [])
          .map((line, index) => (!index ? [line] : [null, line]))))
      || (node["@id"] && stack.document[node["@id"]]);
  if (content) {
    body += stack.emitNode(content, "");
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

function emitAttributes (node, classes) {
  let ret = "";
  let typeClasses = node["vdoc:class"] || "";
  if (node["rdf:type"]) {
    if (node["@id"]) ret += ` id="${node["@id"]}"`;
    typeClasses += `vdoc type-${_classify(node["rdf:type"])}`;
  }
  if (classes) [].concat(typeClasses || [], classes).join(" ");
  if (typeClasses) ret += ` class="${typeClasses}"`;
  if (node["vdoc:style"]) ret += ` style="${node["vdoc:style"]}"`;
  return ret;
}

function _classify (typeString) {
  return typeString.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase().split(":").join("-");
}

function emitArrayHTML (content, emission, stack) {
  let paragraphBegin = 0;
  let ret = emission;
  for (let i = 0; i <= content.length; ++i) {
    if (i < content.length ? (content[i] === null) : paragraphBegin) {
      if (i > paragraphBegin) {
        const body = emitArrayHTML(content.slice(paragraphBegin, i), "", stack);
        ret += ((i === content.length) && !paragraphBegin)
            ? body
            : `      <p>${body}</p>\n`;
      }
      paragraphBegin = i + 1;
    }
  }
  if (paragraphBegin) return ret;
  let listitems = "";
  for (const entry of content) listitems += stack.emitNode(entry, "");
  return `${ret}${listitems}`;
}

function emitChapterHTML (node, emission, stack) {
  return emitNodeHTML(node, emission, stack);
}

function emitBulletListHTML (node, emission, stack) {
  let lis = "";
  for (const entry of (node["vdoc:entries"] || [])) {
    lis += `      <li>${stack.emitNode(entry, "")}</li>\n`;
  }
  return `${emission}\n    <ul>\n${lis}    </ul>\n`;
}

function emitNumberedListHTML (node, emission, stack) {
  let lis = "";
  for (const entry of (node["vdoc:entries"] || [])) {
    lis += `      <li>${stack.emitNode(entry, "")}</li>\n`;
  }
  return `${emission}\n    <ol>\n${lis}    </ol>\n`;
}

function emitTableHTML (node, emission, stack) {
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
    const headerText = stack.emitNode(header["vdoc:content"], "");
    if ([].concat(header["vdoc:layout"] || []).includes("vdoc:wide")) {
      wideRowContents.push({ headerText, cellContent: header["vdoc:cellContent"] });
    } else {
      cellContents.push(header["vdoc:cellContent"]);
      headerTexts.push(`<th${emitAttributes(header)}>${headerText}</th>`);
    }
  }
  const entryTexts = [];
  const lookup = (typeof node["vdoc:lookup"] !== "string") ? node["vdoc:lookup"]
      : stack.document[node["vdoc:lookup"]];
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
          if (patch != null && patch["vdoc:selectField"]) {
            const ret = entryData[patch["vdoc:selectField"]];
            return ret !== undefined ? ret : null;
          }
          return undefined;
        },
      });
    }
    if (typeof entry !== "object") return entry;
    return stack.emitNode(entry, "");
  }
}

function emitReferenceHTML (node, emission, stack) {
  const head = `${emission}<a href="${node["vdoc:ref"]}"${emitAttributes(node)}`;
  return node["vdoc:content"]
      ? `${head}>${stack.emitNode(node["vdoc:content"], "")}</a>`
      : `${head} />`;
}
