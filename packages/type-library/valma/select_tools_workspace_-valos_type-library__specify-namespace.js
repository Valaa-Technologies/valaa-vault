const typeToolset = require("@valos/type-toolset");

exports.vlm = { tool: "specify-namespace" };
exports.command = ".select/.tools/.workspace/@valos/type-library/specify-namespace";
exports.brief = "specify a root ontology namespace";
exports.describe = "Specify a library root ontology namespace via its root revdoc";
exports.introduction = `${exports.describe}.`;

exports.disabled = (yargs) => typeToolset.checkToolSelectorDisabled(yargs.vlm, exports,
    { domain: "", type: "", workspace: "@valos/type-library" });
exports.builder = (yargs) => yargs.options({});

exports.handler = async (yargv) => ({
  devDependencies: {
    "@valos/revdoc": yargv.vlm.domainVersionTag("@valos/kernel"),
  },
  toolsetsUpdate: { [yargv.vlm.toolset]: { tools: { "specify-namespace": {
    inUse: true,
  } } } },
  success: true,
});
