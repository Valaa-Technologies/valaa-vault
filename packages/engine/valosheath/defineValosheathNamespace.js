const { qualifiedNamesOf } = require("@valos/raem/tools/namespaceSymbols");
const { defineNamespace } = require("@valos/revdoc");
const dumpify = require("@valos/tools/dumpify").default;

module.exports = function defineValosheathNamespace (namespace) {
  if (!namespace.vocabulary) namespace.vocabulary = {};

  for (const [name, createParameters] of Object.entries(namespace.definitions)) {
    const { tags, type, description, value, defaultValue } = createParameters();
    const termDefinition = { "@type": "VEngine:Property", tags };
    if (value !== undefined) termDefinition.value = _valueText(value);
    if (defaultValue !== undefined) termDefinition.defaultValue = _valueText(defaultValue);
    function _addLabel (label, indexLabel) {
      (termDefinition["rdfs:label"] || (termDefinition["rdfs:label"] = []))
          .push(label);
      if (indexLabel) {
        (termDefinition["VRevdoc:indexLabel"] || (termDefinition["VRevdoc:indexLabel"] = []))
            .push(indexLabel);
      }
    }
    const domain = [];
    if (tags) {
      termDefinition.tags = tags;
      if (namespace.processTags) {
        for (const [label, indexLabel] of (namespace.processTags(name, tags, domain) || [])) {
          _addLabel(label, indexLabel);
        }
      }
    }
    termDefinition["rdfs:domain"] = !domain.length ? "rdfs:Resource"
        : (domain.length === 1) ? domain[0]
        : domain;
    const range = [];
    if (type) {
      if (type.includes("number")) range.push("xsd:integer");
      if (type.includes("boolean")) range.push("xsd:boolean");
      if (type.includes("string")) range.push("xsd:string");
    }
    termDefinition["rdfs:range"] = !range.length ? "rdfs:Resource"
        : (range.length === 1) ? range[0]
        : range;
    if (description) {
      if (!Array.isArray(description)) {
        termDefinition["rdfs:comment"] = description;
      } else {
        termDefinition["rdfs:comment"] = description[0];
        termDefinition["VRevdoc:introduction"] = description.slice(1);
      }
    }
    namespace.vocabulary[name] = termDefinition;
  }
  return defineNamespace(namespace);

  function _valueText (value) {
    if ((value == null) || (typeof value !== "object")) {
      const qualifiedNames = qualifiedNamesOf(value);
      if (qualifiedNames) return qualifiedNames[2];
      return dumpify(value);
    }
    if (Array.isArray(value)) return `[${value.map(_valueText).join(", ")}]`;
    if (value.delegate) return _valueText(value.delegate);
    return `<${(value.constructor || "").name || "Object"}>`;
  }
};
