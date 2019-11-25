module.exports = {
  validateFormatTerm,
  validateVerbType,
  validateContextTerm,
  validateContextTermNS,
  validateParamValueText,
};

function validateFormatTerm (element) {
  return validateContextTerm(element);
}

function validateVerbType (str) {
  if (typeof str !== "string") {
    throw new Error(`Invalid verb-type: expected string, got ${typeof str}`);
  }
  if (!str.match(/[a-zA-Z0-9\-_.~!*'()]+/)) {
    throw new Error(`Invalid verb-type: doesn't match rule${
      ""} 1*(ALPHA / DIGIT / "-" / "_" / "." / "~" / "!" / "*" / "'" / "(" / ")")`);
  }
  return str;
}

function validateContextTerm (str) {
  if (typeof str !== "string") {
    throw new Error(`Invalid context-term: expected string, got ${typeof str}`);
  }
  if (!str.match(/[a-zA-Z][a-zA-Z0-9\-_.]*/)) {
    throw new Error(`Invalid context-term: "${str}" doesn't match rule${
      ""} ALPHA [ 0*30unreserved-nt ( ALPHA / DIGIT ) ]`);
  }
  return str;
}

function validateContextTermNS (str) {
  if (typeof str !== "string") {
    throw new Error(`Invalid context-term-ns: expected string, got ${typeof str}`);
  }
  if (!str.match(/[a-zA-Z]([a-zA-Z0-9\-_.]{0,30}[a-zA-Z0-9])?/)) {
    throw new Error(`Invalid context-term: "${str}" doesn't match rule${
      ""} ALPHA [ 0*30unreserved-nt ( ALPHA / DIGIT ) ]`);
  }
  return str;
}

function validateParamValueText (str) {
  if (typeof str !== "string") {
    throw new Error(`Invalid vparam-value: expected string, got ${typeof str}`);
  }
  if (!str.match(/([a-zA-Z0-9\-_.~!*'()]|%[0-9a-fA-F]{2})+/)) {
    throw new Error(`invalid param-value: "${str}" doesn't match rule${
      ""} 1*("%" HEXDIG HEXDIG |${
      ""} ALPHA / DIGIT / "-" / "_" / "." / "~" / "!" / "*" / "'" / "(" / ")")`);
  }
  return str;
}
