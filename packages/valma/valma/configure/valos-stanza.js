exports.command = ".configure/.valos-stanza";
exports.describe = "Configure valos stanza type and domain from the available options";
exports.introduction = `${exports.describe}.

Type determines the localized role and structure of this repository.
Domain defines the context and the overall purpose of this repository.
Both affect the available toolsets for the repository.`;

exports.disabled = (yargs) => yargs.vlm.getValOSConfig() && "Already configured";
exports.builder = (yargs) => {
  const vlm = yargs.vlm;
  const valos = vlm.packageConfig.valos || {};
  const typeChoices = vlm.listMatchingCommands(".configure/.type/*")
      .map(n => n.match(/^.configure\/.type\/([^/]*)/)[1])
      .concat("<custom>");
  const domainChoices = vlm.listMatchingCommands(".configure/.domain/*")
      .map(n => n.match(/^.configure\/.domain\/([^/]*)/)[1])
      .concat("<custom>");
  return yargs.options({
    reconfigure: {
      alias: "r", type: "boolean",
      description: "Reconfigure ValOS type and domain of this repository.",
    },
    type: {
      type: "string", default: valos.type, choices: typeChoices,
      interactive: {
        type: "list", when: vlm.reconfigure ? "always" : "if-undefined", pageSize: 10,
        confirm: _inquireIfCustomThenAlwaysConfirm.bind(null, vlm, "type"),
      },
      description: "Select repository package.json stanza valos.type",
    },
    domain: {
      type: "string", default: valos.domain, choices: domainChoices,
      interactive: {
        type: "list", when: vlm.reconfigure ? "always" : "if-undefined", pageSize: 10,
        confirm: _inquireIfCustomThenAlwaysConfirm.bind(null, vlm, "domain"),
      },
      description: "Select repository package.json stanza valos.domain",
    },
  });
};

async function _inquireIfCustomThenAlwaysConfirm (vlm, category, selection, answers) {
  if (selection === "<custom>") {
    answers[category] = await vlm.inquireText(`Enter custom valos.${category}:`);
  }
  vlm.speak(
      await vlm.invoke(`.configure/.${category}/${answers[category]}`, ["--show-introduction"]));
  return vlm.inquireConfirm(`Confirm valos.${category} selection: '${answers[category]}'?`);
}

exports.handler = (yargv) => yargv.vlm.updatePackageConfig({
  valos: {
    type: yargv.type,
    domain: yargv.domain,
  },
});
