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
  if (typeof str !== "string") throw new Error("Invalid verb-type: not a string");
  if (!str.match(/[a-zA-Z0-9\-_.~!*'()]+/)) {
    throw new Error(`Invalid verb-type: doesn't match rule${
      ""} 1*(ALPHA / DIGIT / "-" / "_" / "." / "~" / "!" / "*" / "'" / "(" / ")")`);
  }
  return str;
}

function validateContextTerm (str) {
  if (typeof str !== "string") throw new Error("Invalid context-term: not a string");
  if (!str.match(/[a-zA-Z][a-zA-Z0-9\-_.]*/)) {
    throw new Error(`Invalid context-term: "${str}" doesn't match rule${
      ""} ALPHA [ 0*30unreserved-nt ( ALPHA / DIGIT ) ]`);
  }
  return str;
}

function validateContextTermNS (str) {
  if (typeof str !== "string") throw new Error("Invalid context-term-ns: not a string");
  if (!str.match(/[a-zA-Z]([a-zA-Z0-9\-_.]{0,30}[a-zA-Z0-9])?/)) {
    throw new Error(`Invalid context-term: "${str}" doesn't match rule${
      ""} ALPHA [ 0*30unreserved-nt ( ALPHA / DIGIT ) ]`);
  }
  return str;
}

function validateParamValueText (str) {
  if (typeof str !== "string") throw new Error("Invalid param-value: not a string");
  if (!str.match(/([a-zA-Z0-9\-_.~!*'()]|%[0-9a-fA-F]{2})+/)) {
    throw new Error(`invalid param-value: "${str}" doesn't match rule${
      ""} 1*("%" HEXDIG HEXDIG |${
      ""} ALPHA / DIGIT / "-" / "_" / "." / "~" / "!" / "*" / "'" / "(" / ")")`);
  }
  return str;
}
