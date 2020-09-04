const patchWith = require("@valos/tools/patchWith").default;
const htmlEntities = require("he");
const { VDoc } = require("./ontologies");

module.exports = {
  html: {
    null: emitBreakHTML,
    string: emitValueHTML,
    number: emitValueHTML,
    array: emitArrayHTML,
    object: emitNodeHTML,
    "VDoc:Node": emitNodeHTML,
    "VDoc:Chapter": emitChapterHTML,
    "VDoc:Paragraph": emitParagraphHTML,
    "VDoc:BulletList": emitBulletListHTML,
    "VDoc:NumberedList": emitNumberedListHTML,
    "VDoc:Table": emitTableHTML,
    "VDoc:Reference": emitReferenceHTML,
    "VDoc:CharacterData": emitCharacterDataHTML,
  },
};

function emitBreakHTML (node, emission) {
  return `${emission}<br>`;
}

function emitValueHTML (value, emission) {
  return `${emission}${htmlEntities.encode(value)}`;
}

const htmlElements = Object.entries(VDoc.vocabulary)
    .filter(([, entry]) => entry["VDoc:elementName"])
    .reduce((a, [vdocName, entry]) => { a[`VDoc:${vdocName}`] = entry; return a; }, {});

function emitNodeHTML (node, emission, stack) {
  let body = "";
  if (node["dc:title"]) {
    const selfRef = node["@id"] && stack.document[node["@id"]]
        && `<a aria-label="§" href="#${node["@id"]}">§ </a>`;
    const elem = "h3";
    body += `\n    <${elem}>${selfRef || ""}${stack.emitNode(node["dc:title"], "")}</${elem}>\n`;
  }
  const content = node["VDoc:content"]
      || (node["VDoc:words"] && [].concat(...[].concat(node["VDoc:words"] || [])
          .map((word, index) => (!index ? [word] : [" ", word]))))
      || (node["VDoc:entries"] && [].concat(...[].concat(node["VDoc:entries"] || [])
          .map((line, index) => (!index ? [line] : [null, line]))))
      || (node["@id"] && stack.document[node["@id"]]);
  if (content) {
    body += stack.emitNode(content, "");

    let openers = "", closers = "";
    Object.entries(node).forEach(([key, value]) => {
      const elem = htmlElements[key];
      if (!value || !elem) return;
      openers += `<${elem["VDoc:elementName"]}>`;
      closers = `</${elem["VDoc:elementName"]}>${closers}`;
    });
    if (openers) body = `${openers}${body}${closers}`;

    const attributes = nodeAttributes(node);
    if (node["VDoc:element"] || attributes) {
      const elem = node["VDoc:element"] || (node["VDoc:entries"] ? "div" : "span");
      body = (elem === "span") ? `<${elem}${attributes}>${body}</${elem}>\n` : `
  <${elem}${attributes}>${body}
  </${elem}>\n`;
    }
  }
  return `${emission}${body}`;
}

function nodeAttributes (node, ...classes) {
  let ret = "";
  const typeClasses = [].concat(node["VDoc:class"] || [], ...classes);
  if (node["@type"]) {
    if (node["@id"]) ret += ` id="${node["@id"]}"`;
    typeClasses.push(`type-${node["@type"]}`);
  }
  if (typeClasses.length) {
    ret += ` class="${["vdoc"].concat(typeClasses).map(_classify).join(" ")}"`;
  }
  if (node["VDoc:style"]) ret += ` style="${node["VDoc:style"]}"`;
  return ret;
}

function _classify (typeString) {
  return typeString.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase().split(":").join("-");
}

function emitArrayHTML (content, emission, stack) {
  let paragraphBegin = 0;
  let ret = emission;
  for (let i = 0; i <= content.length; ++i) {
    // TODO(iridian, 2019-10): This is legacy code: paragraph is now
    // done on the extraction side. 'null' array entries should be
    // removed from vdocstate, and then this code can be removed also.
    if (i < content.length ? (content[i] === null) : paragraphBegin) {
      if (i > paragraphBegin) {
        const body = emitArrayHTML(content.slice(paragraphBegin, i), "", stack);
        if (body) {
          ret += ((i === content.length) && !paragraphBegin)
              ? body
              : `      <p>${body}</p>\n`;
        }
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

function emitParagraphHTML (node, emission, stack) {
  const ret = emitNodeHTML(node, "", stack);
  if (!ret) return emission;
  return `${emission}<div><p>${ret}</p></div>`;
}

function emitBulletListHTML (node, emission, stack) {
  let lis = "";
  for (const entry of (node["VDoc:entries"] || [])) {
    lis += `      <li>${stack.emitNode(entry, "")}</li>\n`;
  }
  return `${emission}\n    <ul>\n${lis}    </ul>\n`;
}

function emitNumberedListHTML (node, emission, stack) {
  let lis = "";
  for (const entry of (node["VDoc:entries"] || [])) {
    lis += `      <li>${stack.emitNode(entry, "")}</li>\n`;
  }
  return `${emission}\n    <ol>\n${lis}    </ol>\n`;
}

function emitTableHTML (node, emission, stack) {
  const cellDatas = [];
  const wideRowContents = [];
  const columnHeaderTexts = [];
  let columns = node["VDoc:columns"];
  if (!columns) {
    throw new Error("VDoc:Table is missing columns");
  }
  if (!Array.isArray(columns)) {
    if (columns["VDoc:entries"]) columns = columns["VDoc:entries"];
    else throw new Error("VDoc:Table VDoc:columns is not an array nor doesn't have VDoc:entries");
  }
  for (const column of columns) {
    const cellData = {
      headerText: stack.emitNode(column["VDoc:content"], ""),
      cell: column["VDoc:cell"],
    };
    if (column["VDoc:wide"]) {
      wideRowContents.push(cellData);
    } else {
      cellDatas.push(cellData);
      columnHeaderTexts.push(`<th${nodeAttributes(column)}>${cellData.headerText}</th>`);
    }
  }
  const entryTexts = [];
  const lookup = (typeof node["VDoc:lookup"] !== "string") ? node["VDoc:lookup"]
      : stack.document[node["VDoc:lookup"]];
  const entries = !node["VDoc:entries"]
      ? Object.entries(lookup || {})
      : node["VDoc:entries"].map((entry, index) =>
          (!lookup || (typeof entry === "object") ? [index, entry] : [entry, lookup[entry]]));
  entries.forEach(([entryKey, entryData], entryIndex) => {
    if (entryKey === "@id") return;
    let entryText = "";
    const rowNthNess = entryIndex % 2 ? "" : " vdoc-nth-child-2n";
    let id;
    for (const { cell } of cellDatas) {
      const instance = _instantiateCell(cell, entryKey, entryData);
      if (instance["VDoc:resourceId"]) id = instance["VDoc:resourceId"];
      entryText += `<td>${
        (typeof instance !== "object") ? instance : stack.emitNode(instance, "")}</td>`;
    }
    entryTexts.push(`<tr${id ? ` id="${id}"` : ""}${rowNthNess && ` class="${rowNthNess}"`}>${
      entryText
    }</tr>`);
    for (const { headerText, cell } of wideRowContents) {
      const instance = _instantiateCell(cell, entryKey, entryData);
      entryTexts.push(`<tr class="vdoc vdoc-wide${rowNthNess}"><td>${headerText
        }</td><td colspan=${columns.length - 1 || 1
        }>${(typeof instance !== "object") ? instance : stack.emitNode(instance, "")}</td></tr>`);
    }
  });
  return `${emission}
    <table${nodeAttributes(node)}>
      <thead>
        ${columnHeaderTexts.join(`
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
      "VDoc:selectKey": entryKey,
      "VDoc:selectValue": entryData,
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
          if ((patch != null) && patch["VDoc:selectField"]) {
            const ret = (entryData == null) ? undefined : entryData[patch["VDoc:selectField"]];
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
  const head = `${emission}<a href="${node["VDoc:ref"]}"${nodeAttributes(node)}`;
  return node["VDoc:content"]
      ? `${head}>${stack.emitNode(node["VDoc:content"], "")}</a>`
      : `${head} />`;
}

function emitCharacterDataHTML (node, emission, stack) {
  return `<pre><code>${stack.emitNode({ ...node, "@type": "VDoc:Node" }, "")}</code></pre>`;
}
