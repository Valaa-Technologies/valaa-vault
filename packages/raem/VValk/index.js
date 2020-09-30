module.exports = {
  base: require("@valos/valk/VValk"),
  extenderModule: "@valos/raem/VValk",
  namespaceModules: {
    V: "@valos/space/V",
  },
  vocabulary: {
    ...require("./resolvers"),
  },
};
