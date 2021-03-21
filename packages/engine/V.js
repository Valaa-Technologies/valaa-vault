const valosheathTypes = require("@valos/engine/valosheath/valos/schema").default;
const { qualifiedNamesOf } = require("~/tools/namespace");

module.exports = {
  base: require("@valos/space/V"),
  extenderModule: "@valos/engine/V",
  namespaceModules: {
    VEngine: "@valos/engine/VEngine",
    V: "@valos/space/V",
  },
  vocabulary: _importValosheathTypeProperties("V", valosheathTypes),
};

function _importValosheathTypeProperties (targetPrefix, types) {
  const vocabulary = {};
  /* eslint-disable no-loop-func */
  for (const [typeName, { isGlobal, /* symbols, */ typeFields, prototypeFields }]
      of Object.entries(types)) {
    vocabulary[typeName] = {
      "rdfs:label": [isGlobal ? `window.${typeName}` : `window.valos.${typeName}`],
    };
    for (const [propertyName, propertyValue, isPrototypeProperty] of [
      ...Object.entries(typeFields || {}).map(([name, value]) =>
          [name, value]),
      ...Object.getOwnPropertySymbols(typeFields || {}).map(symbol =>
          [symbol, typeFields[symbol]]),
      ...Object.entries(prototypeFields || {}).map(([name, value]) =>
          [name, value, true]),
      ...Object.getOwnPropertySymbols(prototypeFields || {}).map(symbol =>
          [symbol, prototypeFields[symbol], true]),
    ]) {
      _defineProperty(typeName, propertyName, propertyValue, isPrototypeProperty);
    }
  }

  function _defineProperty (typeName, name, value, isPrototypeProperty) {
    const qualifiedNames = qualifiedNamesOf(name) || [];
    const [prefix, localPart, qualifiedName] = qualifiedNames;
    const isSymbolProperty = !!prefix;
    if (isSymbolProperty && (prefix !== targetPrefix)) {
      // console.debug(`Invalid valosheath prefix '${prefix}' with symbol ${String(name)
      //     }, "${targetPrefix}" expected`);
      return;
    }
    const localName = qualifiedName || name;
    const isMethod = typeof value === "function";
    const label = `${typeName}.${isPrototypeProperty ? "prototype." : ""}${localName}`;
    const ret = {
      "rdfs:label": [label],
      "VRevdoc:indexLabel": `${
          !isPrototypeProperty ? `valos.${typeName}.` : "."}${
          localName}${
          isMethod ? "()" : ""}`,
      [isPrototypeProperty ? "rdfs:domain" : "rdf:subject"]: `V:${typeName}`,
    };
    if (!isMethod) {
      ret["@type"] = isPrototypeProperty ? "VEngine:Property" : "VEngine:ObjectProperty";
      ret["rdfs:range"] = "rdfs:Resource";
    } else {
      ret["@type"] = isPrototypeProperty ? "VEngine:Method" : "VEngine:ObjectMethod";
      ret["rdfs:range"] = value._valkSignature || "() => any";
      ret["rdfs:comment"] = value._valkDescription || null;
      ret["VRevdoc:introduction"] = value._valkIntroduction || null;
      if (value._valkDeprecatedPrefer) {
        ret["VRevdoc:deprecatedInFavorOf"] = value._valkDeprecatedPrefer;
        ret["rdfs:comment"] =
  `${value._valkDeprecation}.
  ${ret["rdfs:comment"]}`;
      }
    }
    vocabulary[isSymbolProperty ? localPart : label] = ret;
  }
  return vocabulary;
}
