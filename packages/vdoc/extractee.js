module.exports = {
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
   * Construct vdoc:CharacterData node with explicit vdoc:language.
   *
   * @param {*} characters
   * @returns
   */
  language (language, characters) {
    return {
      "rdf:type": "vdoc:CharacterData",
      "vdoc:language": language,
      "vdoc:content": [characters],
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
   * @param {*} [{ style }={}]
   * @returns
   */
  ref (text, ref_ = text, { style } = {}) {
    const ret = { "rdf:type": "vdoc:Reference", "vdoc:content": [text], "vdoc:ref": ref_ };
    if (style) ret["vdoc:style"] = style;
    return ret;
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
};
