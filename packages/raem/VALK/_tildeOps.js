// @flow

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
export function isTildeStepName (stepName: ?string) {
  return (typeof stepName === "string") && (stepName[0] === "~")
      && (stepName[1] !== "0") && (stepName[1] !== "1");
}

export function expandTildeVAKON (tildeStepName, vakon) {
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

export function vakonizeExpandedVPath (expandedVPath, containerType = "@", containerIndex = 0) {
  if (!Array.isArray(expandedVPath)) return expandedVPath;
  const type = expandedVPath[0];
  switch (type) {
  case "":
  case ":":
    throw new Error(`Invalid expanded VPath head: ":" and "" can't appear as first entries`);
  case "$": { // eslint-disable-line no-fallthrough
    let value = vakonizeExpandedVPath(expandedVPath[2]);
    if (expandedVPath[1]) {
      expandedVPath[0] = "§:";
      expandedVPath[2] = value;
      value = expandedVPath;
    }
    switch (containerType) {
    case "@":
      // vgrid
      return ["§ref", value];
    case "!":
      // first entry of a trivial resource valk "!"
      if (containerIndex === 1) return ["§$", value];
    case ".": // eslint-disable-line no-fallthrough
      // member access (explicit "." or non-first entry of trivial resource valk "!")
      if ((type === "§") && (expandedVPath[1] === "V")) return ["§.", value[2]];
      return ["§..", value];
    case ":":
    default: // eslint-disable-line no-fallthrough
      return value;
    }
  }
  case "@":
    if (expandedVPath.length === 2) return vakonizeExpandedVPath(expandedVPath[1], "@", 1);
    expandedVPath[0] = "§->";
    break;
  case "~":
    // ref("@valos/raem/VPath#section_structured_scope_property")
    throw new Error("subspace selector not implemented");
  case ".":
    // ref("@valos/raem/VPath#section_structured_scope_property")
    if (expandedVPath.length > 2) {
      throw new Error("multi-param Scope Property selectors not allowed");
    }
    return vakonizeExpandedVPath(expandedVPath[1], ".", 1);
  case "*":
    // ref("@valos/raem/VPath#section_structured_scope_property")
  case "'": // eslint-disable-line no-fallthrough
    // ref("@valos/raem/VPath#section_structured_media")
  case "+": { // eslint-disable-line no-fallthrough
    // ref("@valos/raem/VPath#section_structured_entity")
    const field = type === "*" ? "relations" : type === "'" ? "medias" : "entities";
    if (expandedVPath.length > 2) throw new Error(`multi-param '${field}' selectors not allowed`);
    return ["§->", field,
      ..._filterByFieldValue("name", vakonizeExpandedVPath(expandedVPath[1], type, 1)),
    ];
  }
  case "-":
    // ref("@valos/raem/VPath#section_structured_object_value")
    return ["§->", ..._filterByFieldValue("object", vakonizeExpandedVPath(expandedVPath[1]))];
  case "!": {
    if (expandedVPath.length === 2) return vakonizeExpandedVPath(expandedVPath[1], "!", 1);
    expandedVPath[0] = "§->";
    break;
  }
  default:
    if (type[0] !== "!") throw new Error(`unrecognized verb type: ${JSON.stringify(type)}`);
    expandedVPath[0] = `§${type.slice(1)}`;
    break;
  }
  for (let i = 1; i !== expandedVPath.length; ++i) {
    expandedVPath[i] = vakonizeExpandedVPath(expandedVPath[i], type, i);
  }
  return expandedVPath;
}

function _filterByFieldValue (fieldName, requiredValue) {
  return (typeof requiredValue !== "object")
      ? [
        ["§filter", ["§===", fieldName, requiredValue]]
      ]
      : [
        ["§$<-", "requiredValue", requiredValue],
        ["§filter", ["§===", fieldName, ["§$", "requiredValue"]]],
      ];
}

