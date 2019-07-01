module.exports = {
  /**
   * Construct vdoc:CharacterData node
   *
   * @param {*} characters
   * @returns
   */
  cdata (characters) {
    return { "rdf:type": "vdoc:CharacterData", "vdoc:content": [characters] };
  },

  /**
   * Construct vdoc:BulletList node
   *
   * @param {*} entries
   * @returns
   */
  bulleted (...entries) {
    return { "rdf:type": "vdoc:BulletList", "vdoc:rows": entries };
  },

  /**
   * Construct vdoc:NumberedList node
   *
   * @param {*} entries
   * @returns
   */
  numbered (...entries) {
    return { "rdf:type": "vdoc:NumberedList", "vdoc:rows": entries };
  },

  /**
   * Construct vdoc:Reference node
   *
   * @param {*} text
   * @param {*} [ref_=text]
   * @param {*} [{ style }={}]
   * @returns
   */
  ref (text, ref_ = text, { style } = {}) {
    const ret = { "rdf:type": "vdoc:Reference", "vdoc:content": [text], "vdoc:ref": ref_ };
    if (style) ret["vdoc:style"] = style;
    return ret;
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
};
