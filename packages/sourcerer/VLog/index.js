module.exports = {
  base: require("@valos/log/VLog"),
  extenderModule: "@valos/sourcerer/VLog",
  namespaceModules: {
    VKernel: "@valos/kernel/VKernel",
  },
  vocabulary: {
    ...require("./EventAspects"),
  },
};
