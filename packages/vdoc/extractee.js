/* eslint-disable prefer-rest-params */

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
   * Construct VDoc:CharacterData node
   *
   * @param {string} [language]
   * @param {string} characters
   * @param {Object} [options]
   * @returns
   */
  c (text, { language, ...options } = {}) {
    return {
      "@type": "VDoc:CharacterData",
      "VDoc:content": Array.isArray(text) ? text : [text],
      ...(language && { "VDoc:language": language }),
      ...(options || {}),
    };
  },

  /**
   * Construct VDoc:BulletList node
   *
   * @param {*} entries
   * @returns
   */
  bulleted () {
    return { "@type": "VDoc:BulletList", "VDoc:entries": [].slice.call(arguments) };
  },

  /**
   * Construct VDoc:NumberedList node
   *
   * @param {*} entries
   * @returns
   */
  numbered () {
    return { "@type": "VDoc:NumberedList", "VDoc:entries": [].slice.call(arguments) };
  },

  /**
   * Construct VDoc:Reference node
   *
   * @param {*} text
   * @param {*} [ref_=text]
   * @returns
   */
  ref (text, ref_ = text) {
    return aggregate({
      "@type": "VDoc:Reference", "VDoc:content": [text], "VDoc:ref": ref_,
    }, "VDoc:content", ...[].slice.call(arguments, 2));
  },

  identifize (str) {
    return str.replace(/[^a-zA-Z0-9_]/g, "_");
  },

  /**
   * Construct VDoc:ContextPath node
   *
   * @param {*} contextPath
   * @param {*} contextBase
   * @returns
   */
  cpath (contextPath, contextBase) {
    return {
      "@type": "VDoc:ContextPath",
      "VDoc:content": [contextPath],
      ...(contextBase !== undefined ? {
        "VDoc:context": contextBase,
      } : {}),
    };
  },

  /**
   * Construct VDoc:ContextBase node
   *
   * @param {*} newContextPath
   * @param {*} contextBase
   * @returns
   */
  context (newContextPath, contextBase) {
    return {
      ...module.exports.cpath(newContextPath, contextBase),
      "@type": "VDoc:ContextBase",
    };
  },

  /**
   * Construct a node with VDoc:em property, making node content
   * <em>emphasised</em> (as per html5 'em')
   *
   * @param {*} entries
   * @returns
   */
  em () { return _htmlElement({ "VDoc:em": true }, arguments); },

  /**
   * Construct a node with VDoc:strong property, making node content
   * <strong>strong</strong> (as per html5 'strong')
   *
   * @param {*} entries
   * @returns
   */
  strong () { return _htmlElement({ "VDoc:strong": true }, arguments); },

  heading (levelOrNode) {
    const isAutoLeveled = (typeof levelOrNode !== "number");
    return _htmlElement({ "VDoc:heading": isAutoLeveled ? true : levelOrNode },
        isAutoLeveled ? arguments : [].slice.call(arguments, 1));
  },

  /**
   * Construct a node with VDoc:ins property, marking node content
   * <ins>as a new insertion</ins> (as per html5 'ins')
   *
   * @param {*} entries
   * @returns
   */
  ins () { return _htmlElement({ "VDoc:ins": true }, arguments); },

  /**
   * Construct a node with VDoc:del property, marking node content
   * <del>as deleted</del> (as per html5 'del')
   *
   * @param {*} entries
   * @returns
   */
  del () { return _htmlElement({ "VDoc:del": true }, arguments); },

  /**
   * Construct a node with VDoc:q property, making node content
   * <q>quoted</q> (as per html5 'q')
   *
   * @param {*} entries
   * @returns
   */
  q () { return _htmlElement({ "VDoc:q": true }, arguments); },

  /**
   * Construct a node with VDoc:blockquote property, making node content
   * <blockquote>blockquoted</blockquote> (as per html5 'blockquote')
   *
   * @param {*} entries
   * @returns
   */
  blockquote () { return _htmlElement({ "VDoc:blockquote": true }, arguments); },
};

function _htmlElement (htmlNode, args) {
  return aggregate(aggregate(htmlNode, "VDoc:content", [].slice.call(args)),
      { "@type": "VDoc:Node" });
}
