module.exports = {
  native: {
    postExtend (target, /* patch, key, targetObject, patchObject */) {
      if (target && (this.keyPath.length === 1) && !target["rdf:type"]) {
        target["rdf:type"] = "revdoc:Document";
      }
    },
  },
};
