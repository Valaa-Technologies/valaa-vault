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
  let content;
  const sequence = node["VDoc:words"] || node["VDoc:entries"];
  if (sequence) {
    const mapper = node["VDoc:map"];
    const separator = node["VDoc:separator"] || (node["VDoc:words"] ? " " : undefined);
    content = [].concat(...((sequence == null ? []
        : typeof sequence !== "object" ? [[null, sequence]]
        : Object.entries(!Array.isArray(sequence) ? sequence : [].concat(...sequence)))
    .map(([key, entry]) => {
      const text = !mapper ? entry : _instantiateTemplate(mapper, key, entry);
      return !key || (separator === undefined) ? [text] : [separator, text];
    })));
  } else if (node["VDoc:content"] !== undefined) {
    content = node["VDoc:content"];
  } else if (node["@id"]) {
    content = stack.document[node["@id"]];
  }
  if (content) {
    body += stack.emitNode(content, "");
    let openers = "", closers = "";
    Object.entries(node).forEach(([key, value]) => {
      const elem = (htmlElements[key] || {})["VDoc:elementName"];
      if (elem) {
        if (value) {
          openers += `<${elem}>`;
          closers = `</${elem}>${closers}`;
        }
      } else if (key === "VDoc:heading") {
        const level = (typeof value === "number" ? value : 3);
        openers += `<h${level}>`;
        closers = `</h${level}>${closers}`;
      }
    });
    if (openers) body = `${openers}${body}${closers}`;

    const attributes = nodeAttributes(node);
    if (node["VDoc:element"] || attributes) {
      const elem = node["VDoc:element"] || (node["VDoc:entries"] ? "div" : "span");
      body = (elem === "span") ? `<${elem}${attributes}>${body}</${elem}>\n` : `
  <${elem}${attributes}>${body}
  </${elem}>\n`;
    }
  } else if (node["VDoc:elidable"]) {
    return emission;
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
  return (!lis && node["VDoc:elidable"])
      ? emission
      : `${emission}\n    <ul>\n${lis}    </ul>\n`;
}

function emitNumberedListHTML (node, emission, stack) {
  let lis = "";
  for (const entry of (node["VDoc:entries"] || [])) {
    lis += `      <li>${stack.emitNode(entry, "")}</li>\n`;
  }
  return (!lis && node["VDoc:elidable"])
      ? emission
      : `${emission}\n    <ol>\n${lis}    </ol>\n`;
}

function emitTableHTML (node, emission, stack) {
  const entryRowTemplates = [];
  const columnHeaderTexts = [];
  let columns = node["VDoc:columns"];
  if (!columns) {
    throw new Error("VDoc:Table is missing columns");
  }
  if (!Array.isArray(columns)) {
    if (columns["VDoc:entries"]) columns = columns["VDoc:entries"];
    else throw new Error("VDoc:Table VDoc:columns is not an array nor doesn't have VDoc:entries");
  }
  let cellRowTemplates;
  for (const column of columns) {
    const headerCell = {
      ...column, "@type": "VDoc:Node", "VDoc:cell": undefined, "VDoc:wide": undefined,
    };
    const cellTemplate = ((typeof column["VDoc:cell"] === "object")
            && !column["VDoc:cell"]["VDoc:selectField"])
        ? { ...column["VDoc:cell"] }
        : {
          "@type": "VDoc:Node",
          "VDoc:content": (typeof column["VDoc:cell"] !== "string")
                  || (column["VDoc:cell"].startsWith("VDoc:select"))
              ? column["VDoc:cell"]
              : { "VDoc:selectField": column["VDoc:cell"] },
        };
    if (column["VDoc:wide"]) {
      cellTemplate["VDoc:wide"] = true;
      if (cellTemplate["VDoc:elidable"] === undefined) {
        cellTemplate["VDoc:elidable"] = column["VDoc:elidable"];
      }
      entryRowTemplates.push([
        ...(headerCell["VDoc:content"] || headerCell["VDoc:words"] || headerCell["VDoc:entries"]
            ?  [headerCell] : []),
        cellTemplate,
      ]);
    } else {
      if (!cellRowTemplates) {
        entryRowTemplates.push(cellRowTemplates = []);
      }
      const headerText = stack.emitNode(headerCell, "");
      cellRowTemplates.push(cellTemplate);
      columnHeaderTexts.push(`<th${nodeAttributes(column)}>${headerText}</th>`);
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
    const alternatingRowHighlight = entryIndex % 2 ? "" : " vdoc-nth-child-2n";
    for (const cellTemplates of entryRowTemplates) {
      let rowText = "";
      let idText = "";
      let wideness = "";
      let elideRow;
      for (let i = 0; i !== cellTemplates.length; ++i) {
        const cellTemplate = cellTemplates[i];
        const cell = _instantiateTemplate(cellTemplate, entryKey, entryData);
        if (cell["VDoc:resourceId"]) idText = ` id="${cell["VDoc:resourceId"]}"`;
        const cellText = (typeof cell !== "object") ? cell : stack.emitNode(cell, "");
        let colspan = cell["VDoc:wide"];
        if (colspan && (typeof colspan !== "number")) {
          if (!cellText && (cell || "")["VDoc:elidable"]) {
            elideRow = true;
            break;
          }
          wideness = " vdoc-wide";
          colspan = columnHeaderTexts.length - i;
        }
        rowText += `<td${colspan ? ` colspan=${colspan}` : ""}>${cellText}</td>`;
      }
      if (!elideRow) {
        const class_ = `${wideness}${alternatingRowHighlight}`;
        entryTexts.push(`<tr${idText}${class_ && ` class="vdoc${class_}"`}>${rowText}</tr>`);
      }
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
}

function _instantiateTemplate (template, entryKey, entryData) {
  if (template === undefined) return entryData;
  if (template === null) return null;
  const select = {
    "VDoc:selectKey": entryKey,
    "VDoc:selectValue": entryData,
  };
  let entry;
  if (typeof template === "string") {
    entry = select[template];
    if (entry === undefined) entry = (entryData == null) ? undefined : entryData[template];
  } else {
    entry = patchWith({}, template, {
      preExtend (tgt, patch, key) {
        if ((key === "VDoc:map") || (key === "VDoc:cell")) return patch;
        if (typeof patch === "string") {
          return select[patch] !== undefined ? select[patch] : patch;
        }
        if ((patch != null) && patch["VDoc:selectField"]) {
          const ret = (entryData == null) ? undefined : entryData[patch["VDoc:selectField"]];
          if (ret === undefined) {
            // console.log(`Can't select field '${patch["VDoc:selectField"]
            //     }' from entry with key '${entryKey}'`);
          }
          return ret !== undefined ? ret : null;
        }
        return undefined;
      },
    });
  }
  if (entry == null) return "";
  return entry;
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
