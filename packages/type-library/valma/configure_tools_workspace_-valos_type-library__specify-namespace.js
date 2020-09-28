const typeToolset = require("@valos/type-toolset");

exports.vlm = { tool: "specify-namespace" };
exports.command = ".configure/.tools/.workspace/@valos/type-library/specify-namespace";
exports.brief = "configure the root ontology namespace";
exports.describe = "Configure the root revdoc and its ontology namespace";
exports.introduction = `${exports.describe}.`;

exports.disabled = (yargs) => typeToolset.checkToolDisabled(yargs.vlm, exports);

const allowedNamespacePrefixRegex = "^[a-zA-Z0-9][a-zA-Z0-9_]+[a-zA-Z0-9]$";

exports.builder = (yargs) => yargs.options({
  domain: {
    type: "string",
    description: "The name of the domain used to aggregate all extensions to this namespace",
    interactive: answers => ({
      type: "input", when: answers.reconfigure ? "always" : "if-undefined",
      default: yargs.vlm.getValOSConfig("domain"),
    }),
  },
  "preferred-prefix": {
    type: "string",
    description: "The preferred prefix of the ontology namespace",
    interactive: answers => ({
      type: "input", when: answers.reconfigure ? "always" : "if-undefined",
      confirm: async value => {
        if (!(value || "").match(new RegExp(allowedNamespacePrefixRegex))) {
          yargs.vlm.warn(`Preferred prefix must match the regex: /${allowedNamespacePrefixRegex}/`);
          return false;
        }
        if (value.match(/V[A-Z].*/) && answers.domain !== "@valos/kernel") {
          yargs.vlm.warn(`Preferred prefixes matching 'V[A-Z].*' are reserved for @valos/kernel.`);
          return yargs.vlm.inquireConfirm(`Use "${value}" as preferred prefix anyway?`);
        }
        return true;
      },
    }),
  },
  "base-iri": {
    type: "string",
    description: "The baseIRI of the ontology namespace",
    interactive: answers => {
      const docsBaseIRI = yargs.vlm.findToolConfig("@valos/type-vault", "docs", "docsBaseIRI");
      const name = yargs.vlm.path.basename(process.cwd());
      return {
        type: "input", when: answers.reconfigure ? "always" : "if-undefined",
        default: `${docsBaseIRI || "http://127.0.0.1/"}${name}/0#`,
      };
    },
  },
  "namespace-modules": {
    type: "string", array: true,
    description: "The namespace modules to be added as devDependencies",
    interactive: answers => ({
      type: "input", when: answers.reconfigure ? "always" : "if-undefined",
    }),
  },
  description: {
    type: "string",
    description: "The description of the namespace",
    interactive: answers => ({
      type: "input", when: answers.reconfigure ? "always" : "if-undefined",
    }),
  },
  "revdoc-kind": {
    type: "string",
    description: "The revdoc section kind to emit for the namespace",
    choices: [{
      name: "<none>", value: undefined,
      description: "Don't emit a workspace root revdoc for the ontology",
    }, {
      name: "valospace",
      description: "defines chronicle resources",
    }, {
      name: "valosheath",
      description: "describes valoscript interfaces",
    }, {
      name: "fabric",
      description: "describes infrastructure resources and interfaces",
    }],
    interactive: answers => ({
      type: "list", when: answers.reconfigure ? "always" : "if-undefined",
    }),
  },
  ...typeToolset.createConfigureToolOptions(yargs.vlm, exports),
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const toolConfig = vlm.getToolConfig(yargv.toolset, exports.vlm.tool) || {};
  const toolConfigUpdate = { ...toolConfig };
  const domain = yargv.domain;
  const preferredPrefix = yargv["preferred-prefix"];
  const baseIRI = yargv["base-iri"];

  const devDependencies = {};
  for (const module of (yargv["namespace-modules"] || [])) {
    const packageName = (module.match(/((@[^/]+\/)?[^/]+)\/.*/) || [])[1];
    if (!packageName) {
      throw new Error(`Cannot determine dependency module from namespace module: "${module}"`);
    }
    devDependencies[packageName] = true;
  }
  await vlm.addNewDevDependencies(devDependencies);
  const namespaceModules = {};
  (yargv["namespace-modules"] || []).forEach(module => {
    const namespace = require(module);
    if (!namespace.preferredPrefix) {
      throw new Error(`require("${module}") not a namespace module: no preferredPrefix defined`);
    }
    namespaceModules[namespace.preferredPrefix] = module;
  });

  vlm.shell.ShellString(
`const { specifyNamespace } = require("@valos/revdoc");

module.exports = {
  ...specifyNamespace(require("./${preferredPrefix}")),
};
`).to(vlm.path.join(".", "ontology.js"));

  vlm.shell.ShellString(
`module.exports = {
  domain: "${domain}",
  preferredPrefix: "${preferredPrefix}",
  baseIRI: "${baseIRI}",
  namespaceModules: {
  ${Object.entries(namespaceModules).map(([prefix, module]) => `  ${prefix}: "${module}",
  `).join("")
  }},
  description: "${yargv.description || ""}",
  context: {},
  vocabulary: {},
};
`).to(vlm.path.join(".", `${preferredPrefix}.js`));

  const revdocKind = yargv["revdoc-kind"];
  if (revdocKind) {
    await vlm.invoke("write-revdoc", {
      workspace: true,
      "short-name": `${preferredPrefix.toLowerCase()}Namespace`,
      [revdocKind]: true,
    });
  }

  vlm.updateToolConfig(yargv.toolset, vlm.tool, toolConfigUpdate);
  return {
    success: true,
  };
};
