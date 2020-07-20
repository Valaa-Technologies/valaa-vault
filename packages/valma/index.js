module.exports = {
  createChooseMatchingOption,
  createSelectOfMatchingChoicesOption,
  listMatchingChoices,
  extractChoiceName,
  selectorGlobFrom,
  restrictorPathFrom,
  simpleRestrictorFrom,
  inquireChoiceCommandName,
  updateConfigurableSideEffects,
};


async function updateConfigurableSideEffects (vlm, ...results) {
  const resultBreakdown = {};

  const devDependencies = Object.assign({}, ...results.map(r => (r || {}).devDependencies || {}));
  const newDevDependencies = await vlm.addNewDevDependencies(devDependencies);
  if (newDevDependencies) resultBreakdown.newDevDependencies = newDevDependencies;

  results.forEach(r => (r || {}).toolsetsUpdate && vlm.updateToolsetsConfig(r.toolsetsUpdate));
  resultBreakdown.success = results.reduce((a, r) => a && ((r || {}).success !== false), true);
  return resultBreakdown;
}

function createChooseMatchingOption (vlm, primaryPrefix, choosingPackageConfig, options) {
  return _createChoicesOption(vlm, true, primaryPrefix, choosingPackageConfig, options);
}

function createSelectOfMatchingChoicesOption (vlm, primaryPrefix, selectorPackageConfig, options) {
  return _createChoicesOption(vlm, false, primaryPrefix, selectorPackageConfig, options);
}

function _createChoicesOption (vlm, isSingular, primaryPrefix, selectorPackageConfig, {
  choiceBrief, selectorBrief,
  when, default: defaultAnswer, prependChoices, appendChoices, pageSize, filterChoices,
  confirm, allowGlob, postConfirm, useAnswersReconfigure, enableDisabled,
}) {
  const { name, valos = {} } = selectorPackageConfig;
  return {
    type: "string",
    default: defaultAnswer,
    description: `${isSingular ? "Choose a" : "Pick"} ${
        choiceBrief || `'${primaryPrefix}'`}${
        isSingular ? "" : ` choices`} for ${
        selectorBrief || `'${name}'`}`,
    interactive: async (initialAnswers) => {
      if (useAnswersReconfigure && !initialAnswers.reconfigure && (defaultAnswer !== undefined)) {
        return {};
      }
      const domain = valos.domain;
      let choices = await listMatchingChoices(
          vlm, primaryPrefix, { name, domain, type: valos.type, enableDisabled });
      choices.unshift(...(prependChoices || []).filter(candidate =>
          choices.findIndex(existing => existing.value === candidate.value) === -1));
      choices.push(...(appendChoices || []).filter(candidate =>
          choices.findIndex(existing => existing.value === candidate.value) === -1));
      if (filterChoices) {
        choices = choices.filter(filterChoices);
      }
      return {
        type: isSingular
            ? "list"
            : "checkbox",
        when: when
            || ((useAnswersReconfigure ? initialAnswers.reconfigure : choices.length)
                ? "always" : "if-undefined"),
        choices,
        pageSize: pageSize || 10,
        confirm: confirm || ((isSingular && (confirm !== false))
            && (async (choiceValue, answers, question) => {
          const ret = await inquireChoiceCommandName(vlm, primaryPrefix,
              { prompt: choiceBrief, allowGlob, choiceValue, answers, question });
          if (!ret) return ret;
          if (postConfirm) postConfirm(choiceValue, answers, question);
          return ret;
        })),
      };
    },
  };
}

async function listMatchingChoices (vlm, primaryPrefix, { domain, type, name, enableDisabled }) {
  const results = await vlm.invoke(
      `${primaryPrefix}/${selectorGlobFrom({ domain, type, name })}**/*`,
      ["--show-name", "--show-description"], { "enable-disabled": enableDisabled });
  // console.log("results:", results);
  return results.map(entry => {
    const commandName = Object.keys(entry).find(k => (k !== "..."));
    if (!commandName) return undefined;
    const choiceName = extractChoiceName(commandName, primaryPrefix);
    if (choiceName === undefined) {
      throw new Error(`Could not match choice name from command name '${
          commandName}' with primary prefix '${primaryPrefix}'`);
    }
    return !choiceName ? undefined : {
      name: choiceName, value: choiceName, description: entry[commandName].description,
    };
  }).filter(n => n);
}

function selectorGlobFrom ({ domain, type, workspace }) {
  return `${domain ? `{,.domain/${domain}/}` : ""
      }${type ? `{,.type/${type}/}` : ""
      }${workspace ? `{,.workspace/${workspace}/}` : ""}`;
}

function restrictorPathFrom ({ domain, type, workspace }) {
  return `${domain ? `.domain/${domain}/` : ""
      }${type ? `.type/${type}/` : ""
      }${workspace ? `.workspace/${workspace}/` : ""}`;
}

function simpleRestrictorFrom ({ domain, type, workspace }) {
  return `${domain ? `_domain_${domain.replace("@", "-").replace("/", "_")}` : ""
      }${type ? `_type_${type.replace("@", "-").replace("/", "_")}` : ""
      }${workspace ? `_workspace_${workspace.replace("@", "-").replace("/", "_")}` : ""}`;
}

const _domainEater = "(.domain/(@[^/]*/)?[^/]*/)?";
const _typeEater = "(.type/(@[^/]*/)?[^/]*/)?";
const _workspaceEater = "(.workspace/(@[^/]*/)?[^/]*/)?";
const _extractChoiceName = new RegExp(`^/${_domainEater}${_typeEater}${_workspaceEater}([^.]*)$`);
const _choiceIndex = 7;

function extractChoiceName (choice, prefix) {
  return (choice.slice(prefix.length).match(_extractChoiceName) || [])[_choiceIndex];
}

async function inquireChoiceCommandName (
    vlm, primaryPrefix, { prompt, allowGlob, choiceValue, answers, question }) {
  const choice = question.choices.find(candidate => (candidate.value === choiceValue));
  if (choiceValue === undefined) {
    answers[question.name] = undefined;
  } else {
    if (choiceValue[0] === "<") {
      answers[question.name] = await vlm.inquireText(`Enter ${prompt || primaryPrefix}:`);
    }
    const isGlob = vlm.isGlob(answers[question.name]);
    if (isGlob && !allowGlob) {
      vlm.warn(`Glob values not allowed for '${question.name}'`);
      return false;
    }
    if ((choice || {}).confirm !== false) {
      vlm.speak(await vlm.invoke(
        `${primaryPrefix}/${answers[question.name]}`,
        isGlob
            ? ["--show-name", "--show-description"]
            : ["--show-introduction"]));
    }
  }
  if ((choice || {}).confirm === false) return true;
  return vlm.inquireConfirm(
      `Confirm ${prompt || primaryPrefix} choice: '${answers[question.name]}'?`);
}
