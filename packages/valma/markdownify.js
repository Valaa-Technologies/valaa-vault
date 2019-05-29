const patchWith = require("@valos/tools/patchWith").default;

const _layoutKey = "";
const _spreaderKey = "...";

/**
 * Converts and returns the given value as a Github Formatted Markdown
 * string, see https://github.github.com/gfm/#introduction
 *
 * Purpose of this tool two-fold: to make it possible to have all
 * github markdown documents as JSON objects and also to be able to
 * insert arbitrary tool output JSON values to be part of these
 * documents with minimal additional formatting code.
 *
 * The conversion is then a compromise of two principles:
 * 1. all non-surprising value structures produce non-surprising and
 *    intuitively structured and readable markdown string.
 * 2. any valid GHM output HTML can be produced using a combination of
 *    surprising value structures and inline entries.
 *
 * Tools which are not aware that their JSON output is gfmarkdownified
 * should not naturally or accidentally produce the surprising values.
 * An example of a surprising value structure is an array which
 * otherwise contains objects with only primitive values but the first
 * entry is an array - _toGFMarkdown uses the array to specify the
 * columns of a table.
 * Another example of surprising values are strings containing GFM
 * notation or HTML: these are /not/ escaped and translate as-is to the
 * GFM output string.
 *
 * Non-surprising production rules:
 * 1. Strings as-is, numbers with JSON.stringify, null as "-" and
 *    undefined as "".
 * 2. Empty arrays [] and objects {} affect layout but they are removed
 *    from containing arrays and objects. Empty keys "" are removed.
 * 3. Innermost array (contains only primitive values) is " "-joined.
 *    All isolated singular newlines are removed (and rewritten later).
 * 4. Second and subsequent nesting arrays become numbered lists.
 *    Note: with production rule 2. lists can be enforced like so:
 *      numbered list: [[], "first entry", "second entry"]
 *      unordered list: [{}, "first entry", "second entry"]
 * 5. Isolated objects with primitive values are mapped as GFM tables
 *    with key and value columns properties as its two rows.
 * 6. Consequtive objects with primitive values are mapped as a single
 *    GFM table with the collection of all object keys as columns,
 *    objects as rows and object values as cells in the corresponding
 *    column.
 * 7. Objects with complex values are mapped into chapters with the
 *    object key as header. The deeper the nesting, the lower the
 *    emitted H tag. { "...": [[[[[{}]]]]] }
 *
 * @param {*} value
 * @param {*} theme
 * @param {*} context
 * @returns
 */
function markdownify (value, theme, context) {
  const laidOutJSON = extendWithLayouts(value);
  const markdownifyTheme = createRenderTheme(theme);
  return _renderBlock(laidOutJSON, context || {}, markdownifyTheme);
}

function extendWithLayouts (value, target) {
  return patchWith(target, value, createPatchOptions());
}

module.exports = {
  default: markdownify,
  extendWithLayouts,
  createPatchOptions,
  createRenderTheme,
  render: _renderBlock,
  addLayoutOrderedProperty (target, name, entry, customLayout) {
    const targetLayout = target[_spreaderKey] || (target[_spreaderKey] = {});
    const entries = targetLayout.entries || (targetLayout.entries = []);
    entries.push(customLayout === undefined ? name : [name, customLayout]);
    target[name] = entry;
  },
};

function _getLayout (value, layoutKey = _layoutKey) {
  return ((value != null) && value[layoutKey]) || undefined;
  // console.log("\ngetLayout", value, layoutKey, "\nGOT:", layout, "\n");
  // return (typeof layout !== "string") ? layout : require(layout);
}

/*
  ######  #    #   #####  ######  #    #  #####
  #        #  #      #    #       ##   #  #    #
  #####     ##       #    #####   # #  #  #    #
  #         ##       #    #       #  # #  #    #
  #        #  #      #    #       #   ##  #    #
  ######  #    #     #    ######  #    #  #####
*/

function createPatchOptions (customizations) {
  return Object.assign(Object.create(_deepExtendOptions), customizations);
}

const _deepExtendOptions = Object.freeze({
  require: require, // eslint-disable-line
  spreaderKey: _spreaderKey,
  spread (spreaderValue, target, source, key, targetContainer, sourceContainer) {
    const extendee = (typeof spreaderValue === "string")
        ? this.require(spreaderValue)
        : { [_layoutKey]: spreaderValue };
    if (!Array.isArray(source)) return extendee;
    let inter = this.extend(target, extendee, key, targetContainer, sourceContainer);
    if (source.length >= 2) {
      inter = this.extend(inter, source.slice(2), key, targetContainer, sourceContainer);
    }
    targetContainer[key] = inter;
    return undefined; // Stop further spread-extending
  },
  preExtend (target, source, key, targetContainer) {
    // console.log("target:", target, "\nsource:", source, "\nkey:", key, "\n");
    if (typeof source === "function") return `<function ${source.name}>`;
    if (typeof source !== "object") return undefined;
    if (source === null) return "";
    if ((source[0] === _spreaderKey) || source[_spreaderKey]) return undefined;
    if ((Object.getPrototypeOf(source) !== Object.prototype) && !Array.isArray(source)) {
      throw new Error(`Cannot markdownify a complex object with type '${
          (source.constructor || { name: "<unknown object>" }).name}'`);
    }
    const ret = target || {};
    const containerLayout = _getLayout(targetContainer) || {};
    const layout = ret[_layoutKey] = patchWith(
        _getLayout(ret) || { trivial: true, height: 0, depth: (containerLayout.depth || 0) + 1 },
        _getLayout(source));
    // TODO(iridian): Make the markdownify extend idempotent so that an already extended structure
    // will produce a structure identical to itself when extended onto "undefined".
    return Array.isArray(source)
        ? this._extendArrayBlock(ret, source, layout, containerLayout)
        : this._extendObjectBlock(ret, source, layout, containerLayout);
  },
  postExtend (block, source, key, targetContainer) {
    const layout = _getLayout(block);
    const contextLayout = _getLayout(targetContainer);
    if (contextLayout) {
      contextLayout.height = Math.max(contextLayout.height, ((layout && layout.height) || 0) + 1);
      if (layout && !layout.trivial) delete contextLayout.trivial;
    }
    /*
    if (layout) {
      delete layout.height;
      if (layout.type !== "object") delete layout.depth;
    }
    */
  },
  _extendArrayBlock,
  _extendObjectBlock,
  _extractObjectEntries,
  _resolveObjectColumns,
  _postProcessObjectEntries,
});

function _extendArrayBlock (target, sourceArray, layout, containerLayout) {
  layout.type = "array";
  const lastTargetIndex = target.length || 0;
  const currentEntries = layout.entries || [];
  if ((currentEntries.length + sourceArray.length) === 1) layout.singular = true;
  else delete layout.singular;
  layout.entries = currentEntries.concat(...sourceArray.map((sourceEntry, index) => {
    const block = this.extend(undefined, sourceEntry, lastTargetIndex + index, target, sourceArray);
    const entryLayout = _getLayout(block);
    const subEntries = (entryLayout || {}).entries || [];
    if ((subEntries.length !== 1) || (entryLayout.type !== "object")) {
      target[lastTargetIndex + index] = block;
      return index;
    }
    // Expand single-property 'label' objects to parent
    const subBlock = block[subEntries[0]];
    const subLayout = _getLayout(subBlock);
    if (subLayout && (subLayout.heading === undefined)) subLayout.heading = "";
    if (!target[subEntries[0]]) {
      target[subEntries[0]] = subBlock;
      return subEntries[0];
    }
    if (Array.isArray(target[subEntries[0]])) target[subEntries[0]].push(subBlock);
    else target[subEntries[0]] = [target[subEntries[0]], subBlock];
    return [];
  }));
  if ((containerLayout.type === "array") && containerLayout.singular) {
    layout.type = "list";
    delete layout.trivial;
  } else {
    this._resolveObjectColumns(target, layout);
  }
  return target;
}

function _extendObjectBlock (target, sourceObject, layout, containerLayout) {
  layout.type = "object";
  const newEntries = [];
  this._extractObjectEntries(layout.entries || null, sourceObject, newEntries, target, layout);
  delete layout.trivial;
  if (newEntries.length) layout.entries = newEntries;
  // layout.empty = true;
  let hasOnlyNumbers;
  (layout.entries || []).forEach(entry => {
    const key = _getKey(entry);
    if (isNaN(key)) hasOnlyNumbers = false;
    else if ((String(key) !== "0") && hasOnlyNumbers === undefined) hasOnlyNumbers = true;
    // if ((typeof target[e] !== "object") || !(target[e]["."] || {}).empty) delete layout.empty;
  });
  // console.log("extendObjectBlock, target:", target, "\nlayout:", layout,
  //    "\ncontainer:", containerLayout);
  if ((containerLayout.type === "array") && containerLayout.singular && hasOnlyNumbers) {
    layout.type = "numbered";
  }
  if (layout.columns) {
    const columns = layout.columns;
    this._extractObjectEntries(columns, undefined, layout.columns = [], {}, layout);
  } else this._resolveObjectColumns(target, layout);
  this._postProcessObjectEntries(target, layout.entries, layout);
  this._postProcessObjectEntries(target, layout.columns, layout);
  return target;
}

function _extractObjectEntries (entry, sourceObject, targetEntries, target, layout) {
  // If entryBlock is omitted the entries are inside a layout structure. Limit some operations,
  // notably provide an undefined contextLayout for recursive processing.
  if ((entry === undefined) || (entry === _layoutKey) || (entry === _spreaderKey)) return;
  const callSelf = e => this._extractObjectEntries(e, sourceObject, targetEntries, target, layout);
  if (entry === null) {
    if (sourceObject) Object.keys(sourceObject).sort().forEach(callSelf);
  } else if (Array.isArray(entry)) {
    if ((entry.length !== 2) || (typeof entry[0] !== "string") || (typeof entry[1] !== "object")) {
      entry.forEach(callSelf);
      return;
    }
    const [key, entryLayout] = entry;
    if (sourceObject && (sourceObject[key] === undefined)) return;
    if (!target[key]) {
      const entryBlock = !sourceObject
          ? { [_layoutKey]: {} }
          : this.extend(undefined, sourceObject[key], key, target, sourceObject);
      targetEntries.push(entry);
      target[key] = entryBlock;
    }
    // Update layout.
    if (Object.keys(entry || {}).length) {
      Object.assign(targetEntries.find(([key_]) => (key_ === key))[1], entryLayout);
    }
  } else if (typeof entry === "object") {
    Object.keys(entry).sort().map(key => [key, entry[key]]).forEach(callSelf);
  } else callSelf([String(entry), {}]);
}

function _resolveObjectColumns (target, layout) {
  if (layout.type === "numbered" || layout.chapters || !layout.entries) return;
  let totalElementCount = 0;
  const columns = [];
  const columnLookup = {};
  if ((layout.height === 1) && (layout.type === "object")) {
    layout.columns = [
      [null, { text: layout.keyText || "key" }],
      ["", { text: layout.valueText || "value" }],
    ];
  } else if (layout.height === 2) {
    // Gather all column names from row properties.
    layout.entries.forEach(entry => {
      const rowKey = _getKey(entry);
      const elements = ((target[rowKey] || {})[_layoutKey] || {}).columns;
      if (elements) {
        elements.forEach(element => {
          const [elementKey, elementLayout] = Array.isArray(element) ? element : [element];
          let columnLayout = elementLayout || columnLookup[elementKey];
          if (!columnLayout) {
            columnLayout = columnLookup[elementKey] = {};
            columns.push([elementKey, columnLayout]);
          }
          ++totalElementCount;
          columnLayout.entryCount = (columnLayout.entryCount || 0) + 1;
        });
      }
    });
  }
  if (columns.length
      && (totalElementCount > (columns.length * (layout.entries || [1]).length) / 2)) {
    // Only tablify if more than half of the elements are filled
    Object.assign(layout, { columns });
  }
}

function _postProcessObjectEntries (target, entries, layout) {
  if (!(entries || []).length) return;
  for (let i = 0; i < entries.length; ++i) {
    const entry = target[entries[i][0]];
    const entryLayout = (entry && (typeof entry === "object") && entry[_layoutKey]) || undefined;
    const after = entryLayout && (entryLayout.indexAfter || entryLayout.after);
    if (entryLayout && entryLayout.indexAfter) layout.indexSections = true;
    const afterIndex = (after === undefined)
        ? -1 : entries.findIndex(e => (String(e[0]) === String(after)));
    if ((afterIndex >= 0) && ((afterIndex + 1) !== i)) {
      const extractee = entries.splice(i, 1);
      entries.splice(afterIndex + (afterIndex < i ? 1 : 0), 0, extractee[0]);
      if (afterIndex > i) --i;
    }
  }
  entries.forEach((entry, index) => {
    if (Array.isArray(entry) && !Object.keys(entry[1] || {}).length) entries[index] = entry[0];
  });
}

/*
  #####   ######  #    #  #####   ######  #####
  #    #  #       ##   #  #    #  #       #    #
  #    #  #####   # #  #  #    #  #####   #    #
  #####   #       #  # #  #    #  #       #####
  #   #   #       #   ##  #    #  #       #   #
  #    #  ######  #    #  #####   ######  #    #
*/

function createRenderTheme (theme, customizations) {
  return Object.assign(Object.create(theme), _markdownifyStyles, customizations);
}

const _markdownifyStyles = Object.freeze({
  // join (...texts) { return [].concat(...texts).join(""); },
  code (language, ...body) {
    const last = body[body.length - 1] || "";
    return [`\`\`\`${language}`,
      ((body[0] || "")[0] === "\n") ? "" : "\n",
      ...body,
      (last[last.length - 1] === "\n") ? "" : "\n",
      "```",
    ];
  },
  sectionIndexes: [],
  heading: function heading (maybeHeadingLevel, ...rest) {
    let numbers = [];
    if (this.hasOwnProperty("sectionIndexes")) {
      ++this.sectionIndexes[this.sectionIndexes.length - 1];
      numbers = [this.sectionIndexes.map(i => `${i}.`).join("")];
    }
    return (typeof maybeHeadingLevel !== "number")
        ? [maybeHeadingLevel, ...rest]
        : [`\n${"#".repeat(Math.max(1, Math.min(6, maybeHeadingLevel)))}`, ...numbers, ...rest];
  },
  // paragraphIndent: 0,
  // paragraphPrefix: "",
  // lineLength: 71,
  paragraphize: function paragraphize (text, indent = this.paragraphIndent,
      prefix = this.paragraphPrefix, lineLength = this.lineLength) {
    return _layoutSectionText(text, indent || 0, prefix || "", lineLength || 71);
  },
});

function _renderBlock (block, contextLayout, theme) {
  // console.log("block:", theme.hasOwnProperty("paragraphStyle"), JSON.stringify(block, null, 2));
  if (block === undefined) return "";
  if ((typeof block === "boolean") || (typeof block === "number")) return String(block);
  const layout = _getLayout(block) || {};
  if (layout.hide) return "";
  if (layout.text !== undefined) return layout.text;
  if (layout.columns) {
    return _renderTable(layout.entries || [null], block, layout.columns, layout, theme);
  }
  if ((layout.type === "numbered") || (layout.type === "list")) {
    return _renderList(layout.entries, block, layout, theme);
  }
  const sectionTheme = ((contextLayout.type !== "array") || Array.isArray(block))
      && Object.assign(Object.create(theme), { paragraphStyle: "paragraphize" });
  const sectionText = _maybeRenderSection(block, layout, sectionTheme, theme);
  if (sectionText !== undefined) return sectionText;
  return _renderChapters(
      layout.entries || Object.keys(block).filter(key => (key !== _layoutKey)),
      block, layout, sectionTheme || theme);
}

function _maybeRenderSection (block, layout, sectionTheme, theme) {
  let ret;
  let shouldParagraphize = theme.hasOwnProperty("paragraphStyle");
  // console.log("_maybeRenderSection:", shouldParagraphize, "block:", block,
  //    "\nlayout:", layout, "\n\n");
  if (typeof block === "string") {
    ret = block;
  } else {
    const arrayEntries = (Array.isArray(block) && Object.keys(block))
        || (((layout || {}).type === "array") && layout.entries);
    if (arrayEntries) {
      const styler = (sectionTheme || theme).decoratorOf([
        _getLayoutProperty([layout], "transform"),
        _getLayoutProperty([layout], "style"),
      ]);
      ret = arrayEntries
          .map(key => styler.call(
              block[key], _renderBlock(block[key], layout, sectionTheme || theme)))
          .join(sectionTheme ? "\n" : " ");
    } else return undefined;
    if (!layout.trivial) shouldParagraphize = false;
  }
  return ((ret !== undefined) && shouldParagraphize)
      ? theme.decoratorOf(theme.paragraphStyle).call(block, ret)
      : ret;
}

function _renderChapters (chapters, chapterLookup, chaptersLayout, chaptersTheme) {
  // console.log("renderChapters:", chapters, "\nchaptersLayout:", chaptersLayout);
  const retRows = [];
  if (chaptersLayout.indexSections) {
    chaptersTheme.sectionIndexes = [...chaptersTheme.sectionIndexes, 0];
  }
  chapters.forEach((chapter) => {
    const [chapterName, chapterLayout] = Array.isArray(chapter) ? chapter : [chapter];
    const chapterBlock = chapterLookup[chapterName];
    const lookups = [
      _getLayout(chapterBlock),
      chapterLayout, {
        heading: isNaN(chapterName) && { text: chapterName, style: "bold" }
      },
    ];
    if (_getLayoutProperty(lookups, "hide")) return;
    const heading = _getLayoutProperty(lookups, "heading");
    const headingText = (typeof heading === "string") ? heading : (heading && heading.text);
    if (headingText) {
      retRows.push(
          chaptersTheme.decoratorOf(
              [_getLayoutProperty(lookups, "heading", "style"), { heading: chaptersLayout.depth }])
          .call(chapterBlock, headingText));
    }
    const sectionTheme = _getLayoutProperty(lookups, "oob")
        ? Object.create(chaptersTheme) : chaptersTheme;
    const chapterText = _renderBlock(chapterBlock, chaptersLayout, sectionTheme);
    const transformer = _getLayoutProperty(lookups, "transform");
    const transformedText = !transformer ? chapterText
        : chaptersTheme.decoratorOf(transformer).call(chapterBlock, chapterText);
    const style = _getLayoutProperty(lookups, "elementStyle")
        || _getLayoutProperty(lookups, "style");
    retRows.push(!style ? transformedText
        : chaptersTheme.decoratorOf(style).call(chapterBlock, transformedText));
  });
  return retRows.join("\n");
}

function _renderList (entries, list, layout, theme) {
  const paragraphIndent = (theme.paragraphIndent === undefined) ? 0 : theme.paragraphIndent + 2;
  const paragraphPrefix = layout.type !== "numbered" ? "  " : "   ";
  const listTheme = Object.assign(Object.create(theme), {
    paragraphStyle: "paragraphize", paragraphIndent, paragraphPrefix
  });
  const retRows = entries.map(entry => `${
      " ".repeat(paragraphIndent)}${
      layout.type !== "numbered" ? "-" : `${_getKey(entry)}.`} ${
      _renderBlock(list[_getKey(entry)], layout, listTheme).replace(/^\s*/, "")}`);
  return retRows.join("\n");
}

function _getKey (entry) { return Array.isArray(entry) ? entry[0] : entry; }

function _getLayoutProperty (lookups, ...steps) {
  for (const lookup_ of lookups) {
    if (!lookup_) continue;
    const value = steps.reduce((acc, step) => (acc || {})[step], lookup_);
    if (value !== undefined) return value;
  }
  return undefined;
}

function _renderTable (rowKeys, rowLookup, columns, layout, tableTheme) {
  // console.log("_renderTable, keys:", rowKeys, "\nrowLookup:", rowLookup, "\ncolumns:", columns);
  const rows = [];
  const _escpipe = (v, column) => (column.oob ? v
      : ((typeof v !== "string") ? v : v.replace(/\|/g, "\\|")) || "");
  const columnKeyLayouts = [];
  const oobColumnKeyLayouts = []; // out-of-band ie. too big to fit the table.
  columns.forEach(entry => {
    const [name, layout_] = Array.isArray(entry) ? entry : [entry];
    (!(layout_ || {}).oob ? columnKeyLayouts : oobColumnKeyLayouts)
        .push([name, Object.assign({}, layout_)]);
  });
  const headerRow = !(layout && layout.hideHeaders)
      && columnKeyLayouts.map(([columnKey, columnLayout]) => ([
        _escpipe(columnLayout.text || columnKey, columnLayout),
        columnLayout.headerStyle || columnLayout.style,
      ]));
  let pendingHeaderRow = headerRow;
  for (const rowKey of rowKeys) {
    const rowData = (rowKey === null) ? rowLookup
        : (typeof rowKey !== "object") ? rowLookup[rowKey]
        : rowKey;
    const elementLayouts = (_getLayout(rowData) || {}).elementLayouts || {};
    const _columnElementRenderer = ([columnKey, columnLayout]) => {
      const elementLayout = elementLayouts[columnKey];
      const lookups = [elementLayout, columnLayout];
      const transform = _getLayoutProperty(lookups, "transform");
      let text = (columnKey === null) ? rowKey
          : ((columnKey === "") || (typeof rowData !== "object")) ? rowData
          : (rowData || {})[columnKey];
      if (transform) text = tableTheme.decoratorOf(transform).call(rowData, text);
      if (typeof text !== "string") text = _renderBlock(text, layout, tableTheme);
      return [
        _escpipe(text, elementLayout || columnLayout),
        _getLayoutProperty(lookups, "elementStyle") || _getLayoutProperty(lookups, "style"),
        rowData,
      ];
    };
    if (pendingHeaderRow) {
      rows.push(pendingHeaderRow);
      pendingHeaderRow = null;
      rows.push(null); // header underline placeholder
    }
    rows.push(columnKeyLayouts.map(_columnElementRenderer));
    if (oobColumnKeyLayouts.length) {
      rows.push(...oobColumnKeyLayouts.map(_columnElementRenderer));
      pendingHeaderRow = headerRow;
    }
  }
  // TODO: render pending headers if table is empty?
  columnKeyLayouts.forEach(([, columnLayout], columnIndex) => {
    columnLayout.width = Math.max(...rows.map(
        row => ((Array.isArray(row && row[0]) && row[columnIndex][0]) || "").length));
  });
  // console.log("layouts:", columnKeyLayouts, oobColumnKeyLayouts, "\nrows:", rows);
  const rowStyle = _getLayoutProperty([layout], "elementStyle");
  return rows.map(row => {
    if (row === null) { // header underline placeholder
      return columnKeyLayouts.map(([, columnLayout]) =>
          `${(columnLayout.align || "right") !== "right" ? ":" : "-"}${
              "-".repeat(Math.max(0, (columnLayout.width || 0) - 2))}${
              (columnLayout.align || "left") !== "left" ? ":" : "-"}`
      ).join("|");
    }
    let rowData;
    const _renderElement = ([text_, style_, rowData_], index) => {
      rowData = rowData_;
      const columnLayout = (index === undefined) ? { width: 0 } : columnKeyLayouts[index][1];
      const text = (typeof text_ === "string") ? text_ : `<${typeof text_}>`;
      return `${!style_ ? text : tableTheme.decoratorOf(style_).call(rowData_, text)
          }${" ".repeat(Math.max(0, (columnLayout.width || 0) - text.length))}`;
    };
    let ret = (row.length && !Array.isArray(row[0])) ? _renderElement(row) // oob column
        : row.map(_renderElement).join("|");
    const style = _getLayoutProperty([_getLayout(rowData)], "style") || rowStyle;
    if (style) ret = tableTheme.decoratorOf(style).call(rowData, ret);
    return ret;
  }).join("\n");
}

function _flattenArrays (value) {
  return !Array.isArray(value)
      ? value
      : [].concat(...value.map(_flattenArrays));
}

function _layoutSectionText (section, indent = 0, prefix = "", width = 71) {
  const words = _flattenArrays([section]).join(" ").split(/[\n\r ]+/);
  const prefindent = `${" ".repeat(indent)}${prefix}`;
  let charCount = prefindent.length - 1;
  let line = [];
  const lines = [line];
  for (const word of words) {
    if (charCount + 1 + word.length > width) {
      lines.push(line = []);
      charCount = prefindent.length - 1;
    }
    line.push(word);
    charCount += 1 + word.length;
  }
  return lines.map(linewords => `${prefindent}${linewords.join(" ")}`).join("\n");
}
