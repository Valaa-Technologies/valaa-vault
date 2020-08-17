
const _symbolToQualifiedName = {};

const _namespaces = {};

export function qualifiedSymbol (prefix, localPart) {
  const namespace = _namespaces[prefix] || (_namespaces[prefix] = {});
  let symbol = namespace[localPart];
  if (!symbol) {
    const qualifiedName = `$${prefix}.${encodeURIComponent(localPart)}`;
    symbol = namespace[localPart] = Symbol(qualifiedName);
    const vpathName = `@${qualifiedName}@@`;
    _symbolToQualifiedName[vpathName] = _symbolToQualifiedName[symbol] = Object.freeze([
      prefix, localPart, qualifiedName, vpathName, `@.${qualifiedName}@@`,
    ]);
  }
  return symbol;
}

export function qualifiedNamesOf (symbol) {
  const ret = _symbolToQualifiedName[symbol];
  if (ret || (typeof symbol !== "string")
      || !symbol.startsWith("@$") || !symbol.endsWith("@@")) return ret;
  const dotIndex = symbol.indexOf(".");
  if (dotIndex === -1) return undefined;
  const namespace = symbol.slice(2, dotIndex);
  const name = symbol.slice(dotIndex + 1, symbol.length - 2);
  if (namespace.includes("@") || name.includes("@")) return undefined;
  const resymbol = qualifiedSymbol(namespace, name);
  return _symbolToQualifiedName[resymbol];
}
