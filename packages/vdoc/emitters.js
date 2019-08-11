const patchWith = require("@valos/tools/patchWith").default;
const { vdoc: ontology } = require("./ontologies");

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
    "vdoc:CharacterData": emitCharacterDataHTML,
  },
};

function emitBreakHTML (node, emission) {
  return `${emission}<br>`;
}

function emitValueHTML (value, emission) {
  return `${emission}${value}`;
}

const htmlElements = Object.entries(ontology.vocabulary)
    .filter(([, entry]) => entry["vdoc:elementName"])
    .reduce((a, [vdocName, entry]) => { a[`vdoc:${vdocName}`] = entry; return a; }, {});

function emitNodeHTML (node, emission, stack) {
  let body = "";
  if (node["dc:title"]) {
    body += `\n    <h2>${stack.emitNode(node["dc:title"], "")}</h2>\n`;
  }
  const content = node["vdoc:content"]
      || (node["vdoc:words"] && [].concat(...[].concat(node["vdoc:words"] || [])
          .map((word, index) => (!index ? [word] : [" ", word]))))
      || (node["vdoc:entries"] && [].concat(...[].concat(node["vdoc:entries"] || [])
          .map((line, index) => (!index ? [line] : [null, line]))))
      || (node["@id"] && stack.document[node["@id"]]);
  if (content) {
    body += stack.emitNode(content, "");

    let openers = "", closers = "";
    Object.entries(node).forEach(([key, value]) => {
      const elem = htmlElements[key];
      if (!value || !elem) return;
      openers += `<${elem["vdoc:elementName"]}>`;
      closers = `</${elem["vdoc:elementName"]}>${closers}`;
    });
    if (openers) body = `${openers}${body}${closers}`;

    const attributes = nodeAttributes(node);
    if (node["vdoc:element"] || attributes) {
      const elem = node["vdoc:element"] || (node["vdoc:entries"] ? "div" : "span");
      body = (elem === "span") ? `<${elem}${attributes}>${body}</${elem}>\n` : `
  <${elem}${attributes}>${body}
  </${elem}>\n`;
    }
  }
  return `${emission}${body}`;
}

function nodeAttributes (node, ...classes) {
  let ret = "";
  const typeClasses = [].concat(node["vdoc:class"] || [], ...classes);
  if (node["@type"]) {
    if (node["@id"]) ret += ` id="${node["@id"]}"`;
    typeClasses.push(`type-${node["@type"]}`);
  }
  if (typeClasses.length) {
    ret += ` class="${["vdoc"].concat(typeClasses).map(_classify).join(" ")}"`;
  }
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
  const cellDatas = [];
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
    const cellData = {
      headerText: stack.emitNode(header["vdoc:content"], ""),
      cell: header["vdoc:cell"],
    };
    if (header["vdoc:wide"]) {
      wideRowContents.push(cellData);
    } else {
      cellDatas.push(cellData);
      headerTexts.push(`<th${nodeAttributes(header)}>${cellData.headerText}</th>`);
    }
  }
  const entryTexts = [];
  const lookup = (typeof node["vdoc:lookup"] !== "string") ? node["vdoc:lookup"]
      : stack.document[node["vdoc:lookup"]];
  const entries = !node["vdoc:entries"]
      ? Object.entries(lookup || {})
      : node["vdoc:entries"].map((entry, index) =>
          (!lookup || (typeof entry === "object") ? [index, entry] : [entry, lookup[entry]]));
  entries.forEach(([entryKey, entryData], entryIndex) => {
    if (entryKey === "@id") return;
    let entryText = "";
    const rowNthNess = entryIndex % 2 ? "" : " vdoc-nth-child-2n";
    let id;
    for (const { cell } of cellDatas) {
      const instance = _instantiateCell(cell, entryKey, entryData);
      if (instance["vdoc:resourceId"]) id = instance["vdoc:resourceId"];
      entryText += `<td>${
        (typeof instance !== "object") ? instance : stack.emitNode(instance, "")}</td>`;
    }
    entryTexts.push(`<tr${id ? ` id="${id}"` : ""}${rowNthNess && ` class="${rowNthNess}"`}>${
      entryText
    }</tr>`);
    for (const { headerText, cell } of wideRowContents) {
      const instance = _instantiateCell(cell, entryKey, entryData);
      entryTexts.push(`<tr class="vdoc vdoc-wide${rowNthNess}"><td>${headerText
        }</td><td colspan=${headers.length - 1 || 1
        }>${(typeof instance !== "object") ? instance : stack.emitNode(instance, "")}</td></tr>`);
    }
  });
  return `${emission}
    <table${nodeAttributes(node)}>
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
  function _instantiateCell (cell, entryKey, entryData) {
    const select = {
      "vdoc:selectKey": entryKey,
      "vdoc:selectValue": entryData,
    };
    let entry;
    if (typeof cell === "string") {
      entry = select[cell];
      if (entry === undefined) entry = (entryData == null) ? undefined : entryData[cell];
    } else {
      entry = patchWith({}, cell, {
        preExtend (tgt, patch) {
          if (typeof patch === "string") {
            return select[patch] !== undefined ? select[patch] : patch;
          }
          if ((patch != null) && patch["vdoc:selectField"]) {
            const ret = (entryData == null) ? undefined : entryData[patch["vdoc:selectField"]];
            return ret !== undefined ? ret : null;
          }
          return undefined;
        },
      });
    }
    if (entry == null) return "";
    return entry;
  }
}

function emitReferenceHTML (node, emission, stack) {
  const head = `${emission}<a href="${node["vdoc:ref"]}"${nodeAttributes(node)}`;
  return node["vdoc:content"]
      ? `${head}>${stack.emitNode(node["vdoc:content"], "")}</a>`
      : `${head} />`;
}

function emitCharacterDataHTML (node, emission, stack) {
  return `<code>${stack.emitNode({ ...node, "@type": "vdoc:Node" }, "")}</code>`;
}
