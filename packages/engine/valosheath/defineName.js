const { qualifiedSymbol } = require("@valos/raem/tools/namespaceSymbols");

module.exports = function defineName (
    name, namespace, createNameParameters, commonNameParameters = {}) {
  namespace.definitions[name] = () => ({
    ...createNameParameters(),
    ...commonNameParameters,
  });
  const symbol = namespace.symbols[name] = qualifiedSymbol(namespace.preferredPrefix, name);
  namespace.symbols[symbol] = name; // Symbol -> name reverse lookup
  return namespace.symbols[name];
};
