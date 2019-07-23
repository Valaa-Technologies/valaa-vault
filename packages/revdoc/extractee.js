const { extractee: { ref } } = require("@valos/vdoc");

module.exports = {
  /**
   * Construct ReSpec authors section based on the @valos/type-vault
   * valma configuration of the current working directory.
   *
   * @param {*} authorNames
   * @returns
   */
  authors (...authorNames) {
    const toolsetsPath = `${process.cwd()}/toolsets.json`;
    const authorLookup = (((require(toolsetsPath)["@valos/type-vault"] || {})
        .tools || {}).docs || {}).authors || {};
    return (authorNames || []).map(authorName => {
      const author = authorLookup[authorName];
      if (!author) {
        throw new Error(`Cannot find author '${authorName}' from toolsetConfig("${
          toolsetsPath}")["@valos/type-vault"].tools.docs.authors`);
      }
      return author;
    });
  },

  /**
   * Construct revdoc:dfn element.
   *
   * @param {*} text
   * @param {*} definitionId
   * @param {*} explanation
   * @returns
   */
  dfn (text, definitionId, ...explanation) {
    return {
      "revdoc:dfn": definitionId,
      "vdoc:content": [ref(text, definitionId, { style: "bold" }), ...explanation],
    };
  },

  /**
   * Construct revdoc:Package reference element.
   *
   * @param {*} packageName
   * @param {*} rest
   * @returns
   */
  pkg (packageName, ...rest) {
    return {
      ...ref(packageName, ...rest),
      "rdf:type": "revdoc:Package",
    };
  },

  /**
   * Construct revdoc:Command element.
   *
   * @param {*} parts
   * @returns
   */
  command (...parts) {
    return {
      "rdf:type": "revdoc:Command",
      "vdoc:words": [].concat(...parts.map(
              part => (typeof part !== "string" ? [part] : part.split(/(\s+)/))))
          .filter(w => (typeof w !== "string") || !w.match(/^\s+$/)),
    };
  },

  /**
   * Construct revdoc:CommandLineInteraction rows element.
   *
   * @param {*} rows
   * @returns
   */
  cli (...rows) {
    const commandedRows = rows.map(line => ((typeof line !== "string")
        ? line
        : module.exports.command(line)));
    let currentContext = "";
    const contextedRows = [];
    for (const row of commandedRows) {
      if ((row != null) && (row["rdf:type"] === "vdoc:ContextBase")) {
        currentContext = row;
      } else {
        contextedRows.push([currentContext, "$ ", row]);
      }
    }
    return {
      "rdf:type": "revdoc:CommandLineInteraction",
      "vdoc:entries": contextedRows,
    };
  },

  emphasis (...entries) {
    return {
      "vdoc:content": entries,
    };
  },

  strong (...entries) {
    return {
      "vdoc:content": entries,
    };
  },

  strikethrough (...entries) {
    return {
      "vdoc:content": entries,
    };
  }
};
