const { listMatchingConfigurableChoices, inquireConfigurableName } = require("valma");

exports.command = ".configure/.valos-stanza";
exports.describe = "Configure valos stanza type and domain from the available options";
exports.introduction = `${exports.describe}.

Type determines the localized role and structure of this workspace.
Domain defines the context and the overall purpose of this workspace.
Both affect the available toolsets for the workspace.`;

exports.disabled = (yargs) => yargs.vlm.getValOSConfig()
    && (yargs.vlm._packageConfigStatus.workspacePath === process.cwd()) && "Already configured";

exports.builder = (yargs) => {
  const vlm = yargs.vlm;
  const valos = ((yargs.vlm._packageConfigStatus.workspacePath === process.cwd())
          && vlm.getValOSConfig());
  return yargs.options({
    reconfigure: {
      alias: "r", type: "boolean",
      description: "Reconfigure ValOS type and domain of this workspace.",
    },
    type: {
      type: "string", default: valos.type,
      description: "Select workspace package.json stanza valos.type",
      interactive: async () => ({
        type: "list", when: vlm.reconfigure ? "always" : "if-undefined", pageSize: 10,
        choices: [].concat(
            await listMatchingConfigurableChoices(vlm, "type"),
            {
              name: "<custom type>", value: "<custom type>",
              description: "<enter custom type>",
            }),
        confirm: (...rest) => inquireConfigurableName(vlm, "type", "valos.type", ...rest),
      }),
    },
    domain: {
      type: "string", default: valos.domain,
      description: "Select workspace package.json stanza valos.domain",
      interactive: async () => ({
        type: "list", when: vlm.reconfigure ? "always" : "if-undefined", pageSize: 10,
        choices: [].concat(
            await listMatchingConfigurableChoices(vlm, "domain"),
            {
              name: "<unlisted>", value: "<unlisted>",
              description: "<enter the name of an existing but unlisted domain>",
            },
            ((!valos.type || (valos.type === "vault")) && {
              name: "<create>", value: "<create>",
              description: "<enter the name of a new domain this workspace introduces>",
            }) || []),
        confirm: (selection, answers, ...rest) => {
          if (selection === "<create>") answers.isNewDomain = true;
          return inquireConfigurableName(vlm,
              "domain", "valos.domain", selection, answers, ...rest);
        },
      }),
    },
  });
};

exports.handler = (yargv) => ({
  valos: { type: yargv.type, domain: yargv.domain },
  isNewDomain: yargv.isNewDomain,
});
