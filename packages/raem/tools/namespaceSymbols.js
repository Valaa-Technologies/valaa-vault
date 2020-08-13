
const _symbolToQualifiedName = {};

const _namespaces = {};

export function qualifiedSymbol (prefix, localPart) {
  const namespace = _namespaces[prefix] || (_namespaces[prefix] = {});
  let symbol = namespace[localPart];
  if (!symbol) {
    const qualifiedName = `$${prefix}.${encodeURIComponent(localPart)}`;
    symbol = namespace[localPart] = Symbol(qualifiedName);
    _symbolToQualifiedName[symbol] = Object.freeze([
      prefix, localPart, qualifiedName, `@${qualifiedName}@@`, `@.${qualifiedName}@@`,
    ]);
  }
  return symbol;
}

export function qualifiedNameOf (symbol) {
  return _symbolToQualifiedName[symbol];
}
