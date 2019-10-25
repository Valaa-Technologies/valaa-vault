// @flow

module.exports = {
  isTildeStepName,
  expandTildeVAKON,
};

// VALK Tilde expansion notation maintains asymmetric compatibility
// with JSON pointers ( https://tools.ietf.org/html/rfc6901 ):
// 1. valid JSON pointers are treated unchanged literals when evaluated
// as VAKON, even if they appear as the first entry of an array. This
// allows for JSON pointer manipulation and value passing without
// additional escaping.
// 2. valid tilde-notation VAKON kueries are always invalid JSON
// pointer values. This prevents accidental misuse: the leading VAKON
// operation almost invariably has a semantic meaning that conflicts
// with JSON pointer semantics.
function isTildeStepName (stepName: ?string) {
  return (typeof stepName === "string") && (stepName[0] === "~")
      && (stepName[1] !== "0") && (stepName[1] !== "1");
}

function expandTildeVAKON (tildeStepName, vakon) {
  const solidusSplit = tildeStepName.split("/");
  const expansion = (solidusSplit.length === 1)
      ? _tildeSemiColonExpand(tildeStepName)
      : ["§->",
        ...solidusSplit.map(solidusStep => (isTildeStepName(solidusStep)
            ? _tildeSemiColonExpand(solidusStep)
            : ["§..", solidusStep]))
      ];
  if (vakon && (vakon.length > 1)) expansion.push(...vakon.slice(1));
  return expansion;
  function _tildeSemiColonExpand (substep) {
    return substep.split(";")
        .map((s, index) => (!index ? `§${s.slice(1)}`
            : isTildeStepName(s) ? [`§${s.slice(1)}`]
            : s));
  }
}
