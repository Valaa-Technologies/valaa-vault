module.exports = {
  native: {
    postApplyPatch (target, /* patch, key, parentTarget, patchKey, parentPatch */) {
      if (target && (this.keyPath.length === 1) && !target["@type"]) {
        target["@type"] = "VRevdoc:Document";
      }
    },
  },
};
