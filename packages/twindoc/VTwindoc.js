module.exports = {
  domain: "@valos/kernel",
  preferredPrefix: "VTwindoc",
  baseIRI: "https://valospace.org/twindoc/0#",
  namespaceModules: {
    VKernel: "@valos/kernel/VKernel",
    VTwindoc: "@valos/twindoc/VTwindoc",
  },
  description:
`'VTwindoc' namespace provides vocabulary for defining hypertwin
mappings and configurations; actual hypertwin content is represented
using the valos core ontologies and possible extension content
ontologies.`,
  context: {
    restriction: { "@reverse": "owl:onProperty" },
  },
};
