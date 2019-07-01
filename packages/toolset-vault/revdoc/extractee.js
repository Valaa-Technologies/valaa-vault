const { extractee: { ref } } = require("@valos/toolset-vault/vdoc");

module.exports = {
  /**
   * Construct ReSpec editors section based on the @valos/toolset-vault
   * valma configuration of the current working directory.
   *
   * @param {*} editorNames
   * @returns
   */
  editors (...editorNames) {
    const editorsPath = `${process.cwd()}/toolsets.json`;
    const editorLookup = ((require(editorsPath)["@valos/toolset-vault"] || {})
        .revdoc || {}).editors || {};
    return (editorNames || []).map(editorName => {
      const editor = editorLookup[editorName];
      if (!editor) {
        throw new Error(`Cannot find editor '${editorName}' from toolsetConfig("${
          editorsPath}")["@valos/toolset-vault"].revdoc.editors`);
      }
      return editor;
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
      "vdoc:rows": contextedRows,
    };
  }
};
