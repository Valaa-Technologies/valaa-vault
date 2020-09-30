module.exports = {
  base: require("@valos/valk/VValk"),
  extenderModule: "@valos/sourcerer/VValk",
  namespaceModules: {
    V: "@valos/space/V",
  },
  vocabulary: {
    ...require("./resolvers"),
  },
};
