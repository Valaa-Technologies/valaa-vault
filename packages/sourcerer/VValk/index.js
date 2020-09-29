module.exports = {
  base: require("@valos/valk/VValk"),
  extenderModule: "@valos/sourcerer/VValk",
  namespaceModules: {
    V: "@valos/kernel/V",
  },
  vocabulary: {
    ...require("./resolvers"),
  },
};
