module.exports = {
  base: require("@valos/space/V"),
  extenderModule: "@valos/raem/V",
  namespaceModules: {
    VKernel: "@valos/kernel/VKernel",
    VState: "@valos/state/VState",
    VPlot: "@valos/plot/VPlot",
  },
  vocabulary: {
    ...require("./Resource"),
    ...require("./Bvob"),
    ...require("./Absent"),
    ...require("./Extant"),
    ...require("./NonExistent"),
  },
};
