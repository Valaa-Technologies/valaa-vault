const isSymbol = require("~/tools/isSymbol").default;

const _symbolToQualifiedName = Object.create(null);

const _namespaces = Object.create(null);
const _deprecatedNamespaces = Object.create(null);
const _null = Object.create(null);

export function qualifiedSymbol (prefix, localPart) {
  const namespace = _namespaces[prefix] || (_namespaces[prefix] = Object.create(null));
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

export function deprecateSymbolInFavorOf (deprecatedPrefix, deprecatedLocalPart, favoredSymbol) {
  if (!isSymbol(favoredSymbol)) {
    throw new Error(`favoredSymbol is not a symbol: ${String(favoredSymbol)}`);
  }
  const namespace = _deprecatedNamespaces[deprecatedPrefix]
      || (_deprecatedNamespaces[deprecatedPrefix] = Object.create(null));
  return (namespace[deprecatedLocalPart] = favoredSymbol);
}

export function qualifiedNamesOf (symbol) {
  const ret = _symbolToQualifiedName[symbol];
  if (ret || (typeof symbol !== "string")
      || !symbol.startsWith("@$") || !symbol.endsWith("@@")) {
    return ret;
  }
  const dotIndex = symbol.indexOf(".");
  if (dotIndex === -1) return undefined;
  const namespace = symbol.slice(2, dotIndex);
  const name = symbol.slice(dotIndex + 1, symbol.length - 2);
  if (namespace.includes("@") || name.includes("@")) return undefined;
  const resymbol = qualifiedSymbol(namespace, name);
  return _symbolToQualifiedName[resymbol];
}
