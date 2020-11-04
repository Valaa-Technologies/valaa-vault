const isSymbol = require("./isSymbol").default;
const dumpify = require("./dumpify").default;

const _symbolToQualifiedName = Object.create(null);

const _namespaces = Object.create(null);
const _deprecatedNamespaces = Object.create(null);
const _null = Object.create(null);

module.exports = {
  qualifiedSymbol,
  qualifierNamespace,
  deprecateSymbolInFavorOf,
  qualifiedNamesOf,
  $,
  namespacedSymbolTag,
  buildNamespaceSpecification,
};

function qualifierNamespace (prefix) {
  let ret = _namespaces[prefix];
  if (!ret) {
    // TODO(iridian, 2020-11): Validate namespace prefix.
    ret = _namespaces[prefix] = Object.create(null);
  }
  return ret;
}

function qualifiedSymbol (prefix, localPart) {
  const namespace = _namespaces[prefix] || qualifierNamespace(prefix);
  let symbol = namespace[localPart];
  if (!symbol) {
    const deprecationForward = (_deprecatedNamespaces[prefix] || _null)[localPart];
    if (deprecationForward) {
      console.warn(`DEPRECATED: qualified symbol $${prefix}.${localPart
          } is deprecated in favor of ${(qualifiedNamesOf(deprecationForward) || [])[2]}`);
      symbol = deprecationForward;
    } else {
      const qualifiedName = `$${prefix}.${encodeURIComponent(localPart)}`;
      symbol = Symbol(qualifiedName);
      const vpathName = `@${qualifiedName}@@`;
      _symbolToQualifiedName[vpathName] = _symbolToQualifiedName[symbol] = Object.freeze([
        prefix, localPart, qualifiedName, vpathName, `@.${qualifiedName}@@`,
      ]);
    }
    namespace[localPart] = symbol;
  }
  return symbol;
}

function $ (...rest) {
  return typeof rest[0] === "string"
      ? namespacedSymbolTag(rest)
      : namespacedSymbolTag(...rest);
}

function namespacedSymbolTag (strings, ...rest) {
  let prefix = "", localPart;
  for (let i = 0; i !== strings.length; ++i) {
    if (localPart !== undefined) {
      localPart = `${localPart}${rest[i - 1]}${strings[i]}`;
      continue;
    }
    const current = strings[i];
    const colonIndex = current.indexOf(":");
    if (colonIndex === -1) {
      prefix = `${prefix}${current}${rest[i]}`;
    } else {
      prefix = `${prefix}${current.slice(0, colonIndex)}`;
      localPart = current.slice(colonIndex + 1);
    }
  }
  if (localPart === undefined) {
    throw new Error("Missing ':'-separator between namespace and local part");
  }
  return qualifiedSymbol(prefix, localPart);
}

function deprecateSymbolInFavorOf (deprecatedPrefix, deprecatedLocalPart, favoredSymbol) {
  if (!isSymbol(favoredSymbol)) {
    throw new Error(`favoredSymbol is not a symbol: ${String(favoredSymbol)}`);
  }
  const namespace = _deprecatedNamespaces[deprecatedPrefix]
      || (_deprecatedNamespaces[deprecatedPrefix] = Object.create(null));
  return (namespace[deprecatedLocalPart] = favoredSymbol);
}

function qualifiedNamesOf (symbol) {
  const ret = _symbolToQualifiedName[symbol];
  if (ret || (typeof symbol !== "string")
      || !symbol.startsWith("@$") || !symbol.endsWith("@@")) {
    return ret;
  }
  const dotIndex = symbol.indexOf(".");
  if (dotIndex === -1) return undefined;
  const namespaceName = symbol.slice(2, dotIndex);
  const name = symbol.slice(dotIndex + 1, symbol.length - 2);
  if (namespaceName.includes("@") || name.includes("@")) return undefined;
  const resymbol = qualifiedSymbol(namespaceName, name);
  return _symbolToQualifiedName[resymbol];
}

function buildNamespaceSpecification (namespaceSpec) {
  const ret = {
    ...namespaceSpec,
  };
  const preferredPrefix = ret.preferredPrefix || (ret.base || {}).preferredPrefix;
  if (!preferredPrefix) {
    throw new Error("namespaceSpec must define either .preferredPrefix or .base.preferredPrefix");
  }
  for (const entryKey of ["declarations", "symbolToName", "symbols", "vocabulary"]) {
    const current = namespaceSpec[entryKey];
    ret[entryKey] = !current ? {}
        : (typeof current === "function") ? current.call(ret)
        : current;
  }
  if (namespaceSpec.declareNames) {
    namespaceSpec.declareNames.call(ret, { declareName });
  }
  Object.assign(ret.symbols, ret.symbolToName);
  _defineDeclarations();
  return ret;

  function declareName (name, declaration) {
    ret.declarations[name] = declaration;
    const symbol = ret.symbols[name] = qualifiedSymbol(preferredPrefix, name);
    ret.symbolToName[symbol] = name; // Symbol -> name reverse lookup
    return symbol;
  }

  function _defineDeclarations () {
    // eslint-disable-next-line prefer-const
    for (let [name, declaration] of Object.entries(ret.declarations)) {
      if (typeof declaration === "function") {
        ret.declarations[name] = declaration = declaration();
      }
      const { tags, type, description, value, defaultValue } = declaration;
      const termDefinition = { "@type": "VEngine:Property", tags };
      if (value !== undefined) termDefinition.value = _valueText(value);
      if (defaultValue !== undefined) termDefinition.defaultValue = _valueText(defaultValue);
      function addLabel (label, indexLabel, labelTooltip) {
        const labels = (termDefinition["rdfs:label"] || (termDefinition["rdfs:label"] = []));
        labels.push(!labelTooltip ? label : {
          "@type": "VRevdoc:Tooltip",
          "VDoc:content": [label],
          "VRevdoc:tooltipContent": labelTooltip,
        });
        if (indexLabel) {
          (termDefinition["VRevdoc:indexLabel"] || (termDefinition["VRevdoc:indexLabel"] = []))
              .push(indexLabel);
        }
      }
      const domain = [];
      if (tags) {
        termDefinition.tags = tags;
      }
      if (ret.processDeclaration) {
        ret.processDeclaration(name, declaration, { domain, addLabel });
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
      ret.vocabulary[name] = termDefinition;
    }
  }

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
}
