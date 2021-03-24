export function _getChronicleURIFromRoutePlot (authorityURI, routePlot) {
  const params = routePlot.split("!");
  if (params.length !== 1) {
    throw new Error(`Invalid chronicle plot: 1 param expected, got ${params.length}`);
  }
  const [term, suffix] = params[0].split("'");
  if (term[0] !== "~") {
    throw new Error(`Invalid chronicle plot term: expected "~" as first char, got "${term}"`);
  }
  if (!suffix) {
    throw new Error(`Invalid nully chronicle plot suffix`);
  }
  return `${authorityURI}?id=@$${term}.${suffix}@@`;
}
