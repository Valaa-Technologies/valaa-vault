const { createChooseMatchingOption } = require("valma");

exports.command = ".configure/.valos-stanza";
exports.describe = "Configure valos stanza type and domain using available domains";
exports.introduction = `${exports.describe}.

Type determines the localized role and structure of this workspace.
Domain defines the context and the overall purpose of this workspace.
Both affect the available toolsets for the workspace.`;

exports.disabled = (yargs) =>
    (yargs.vlm.getValOSConfig() ? "Valos stanza is already configured" : undefined);

exports.builder = (yargs) => {
  const vlm = yargs.vlm;
  const currentPackage = (yargs.vlm._packageConfigStatus.workspacePath === process.cwd())
      && vlm.getPackageConfig();
  const currentValos = (currentPackage || {}).valos || {};
  const selectorPackageConfig = currentPackage || vlm.getPackageConfig();
  return yargs.options({
    domain: createChooseMatchingOption(vlm, ".select/.domain", selectorPackageConfig, {
      default: currentValos.domain,
      choiceBrief: "package.json:valos.domain",
      selectorBrief: "the new workspace",
      useAnswersReconfigure: true,
      appendChoices: [
        {
          name: "<no domain>", value: "",
          description: "<this workspace is not part of a domain>",
          confirm: false,
        },
        ...((!currentValos.type || (currentValos.type === "vault")) ? [{
          name: "<create>", value: "<create>",
          description: "<enter the name of a new domain this workspace introduces>",
          confirm: false,
        }] : []),
        {
          name: "<unlisted>", value: "<unlisted>",
          description: "<enter the name of an existing but unlisted domain>",
        },
      ],
      postConfirm: (choice, answers) => {
        if (choice === "<create>") answers.isNewDomain = true;
      },
    }),
    type: createChooseMatchingOption(vlm, ".select/.type", selectorPackageConfig, {
      default: currentValos.type,
      choiceBrief: "package.json:valos.type",
      selectorBrief: "the new workspace",
      useAnswersReconfigure: true,
      prependChoices: [
        {
          name: "<custom>", value: "<custom>",
          description: "<enter custom type>",
        },
      ],
    }),
    reconfigure: {
      alias: "r", type: "boolean",
      description: "Reconfigure ValOS type and domain of this workspace.",
    },
  });
};

exports.handler = (yargv) => ({
  valos: { type: yargv.type, domain: yargv.domain },
  isNewDomain: yargv.isNewDomain,
});
