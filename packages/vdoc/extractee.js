/**
 * Aggregates given aggregatees into the given aggregateProperty of
 * the given parent. If there is only a single aggregatees entry and
 * it is a non-array object, its contents are merged into parent by
 * choosing all fields that are missing from it.
 *
 * @param {*} parent
 * @param {*} aggregatedField
 * @param {*} aggregatees
 * @returns
 */
function aggregate (parent, aggregatedField, ...aggregatees) {
  if (!aggregatees.length) return parent;
  const first = aggregatees[0];
  let ret = parent, aggregatees_ = aggregatees;
  if ((first != null) && (typeof first === "object") && !Array.isArray(first)) {
    ret = Object.assign({}, first, parent);
    aggregatees_ = (first[aggregatedField] == null) ? [] : [first[aggregatedField]];
  }
  const aggregated = [].concat(
      (parent[aggregatedField] == null) ? [] : parent[aggregatedField],
      ...aggregatees_);
  if (aggregated.length) ret[aggregatedField] = aggregated;
  return ret;
}

module.exports = {
  aggregate,

  /**
   * Construct vdoc:CharacterData node
   *
   * @param {string} [language]
   * @param {string} characters
   * @param {Object} [options]
   * @returns
   */
  c (languageOrCharacters, charactersOrOptions, options) {
    return {
      "rdf:type": "vdoc:CharacterData",
      ...(typeof charactersOrOptions === "string" ? {
        "vdoc:language": languageOrCharacters,
        "vdoc:content": [charactersOrOptions],
        ...(options || {}),
      } : {
        "vdoc:content": [languageOrCharacters],
        ...(charactersOrOptions || {}),
      }),
    };
  },

  /**
   * Construct vdoc:BulletList node
   *
   * @param {*} entries
   * @returns
   */
  bulleted () {
    return { "rdf:type": "vdoc:BulletList", "vdoc:entries": [].slice.call(arguments) };
  },

  /**
   * Construct vdoc:NumberedList node
   *
   * @param {*} entries
   * @returns
   */
  numbered () {
    return { "rdf:type": "vdoc:NumberedList", "vdoc:entries": [].slice.call(arguments) };
  },

  /**
   * Construct vdoc:Reference node
   *
   * @param {*} text
   * @param {*} [ref_=text]
   * @returns
   */
  ref (text, ref_ = text) {
    return aggregate({
      "rdf:type": "vdoc:Reference", "vdoc:content": [text], "vdoc:ref": ref_,
    }, "vdoc:content", ...[].slice.call(arguments, 2));
  },

  identifize (str) {
    return str.replace(/[^a-zA-Z0-9_]/g, "_");
  },

  /**
   * Construct vdoc:ContextPath node
   *
   * @param {*} contextPath
   * @param {*} contextBase
   * @returns
   */
  cpath (contextPath, contextBase) {
    return {
      "rdf:type": "vdoc:ContextPath",
      "vdoc:content": [contextPath],
      ...(contextBase !== undefined ? {
        "vdoc:context": contextBase,
      } : {}),
    };
  },

  /**
   * Construct vdoc:ContextBase node
   *
   * @param {*} newContextPath
   * @param {*} contextBase
   * @returns
   */
  context (newContextPath, contextBase) {
    return {
      ...module.exports.cpath(newContextPath, contextBase),
      "rdf:type": "vdoc:ContextBase",
    };
  },

  /**
   * Construct a node with vdoc:em property, making node content
   * <em>emphasised</em> (as per html5 'em')
   *
   * @param {*} entries
   * @returns
   */
  em () { return _htmlElement({ "vdoc:em": true }, arguments); },

  /**
   * Construct a node with vdoc:strong property, making node content
   * <strong>strong</strong> (as per html5 'strong')
   *
   * @param {*} entries
   * @returns
   */
  strong () { return _htmlElement({ "vdoc:strong": true }, arguments); },

  /**
   * Construct a node with vdoc:ins property, marking node content
   * <ins>as a new insertion</ins> (as per html5 'ins')
   *
   * @param {*} entries
   * @returns
   */
  ins () { return _htmlElement({ "vdoc:ins": true }, arguments); },

  /**
   * Construct a node with vdoc:del property, marking node content
   * <del>as deleted</del> (as per html5 'del')
   *
   * @param {*} entries
   * @returns
   */
  del () { return _htmlElement({ "vdoc:del": true }, arguments); },

  /**
   * Construct a node with vdoc:quote property, making node content
   * <q>quoted</q> (as per html5 'q')
   *
   * @param {*} entries
   * @returns
   */
  quote () { return _htmlElement({ "vdoc:quote": true }, arguments); },

  /**
   * Construct a node with vdoc:blockquote property, making node content
   * <blockquote>blockquoted</blockquote> (as per html5 'blockquote')
   *
   * @param {*} entries
   * @returns
   */
  blockquote () { return _htmlElement({ "vdoc:blockquote": true }, arguments); },
};

function _htmlElement (htmlNode, args) {
  return aggregate(aggregate(htmlNode, "vdoc:content", [].slice.call(args)),
      { "rdf:type": "vdoc:Node" });
}
