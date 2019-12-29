#!/usr/bin/env vlm

exports.command = "draft-command [commandName]";
exports.describe = "Draft and possibly export a new valma command script";
exports.introduction =
`The new command is drafted as a local valma.bin/ command with the
source file in valma/, making it the highest priority command and
immediately available.
With --import a existing exported script is copied for local editing
and development.`;

exports.disabled = (yargs) => !yargs.vlm.packageConfig && "No package.json found";
exports.builder = (yargs) => yargs.options({
  filename: {
    type: "string",
    description: "The new command skeleton filename in valma/ (leave empty for default)",
    interactive: { type: "input", when: "if-undefined" }
  },
  brief: {
    type: "string", description: "Description of couple words of the new command",
  },
  export: {
    type: "boolean", default: false,
    description: "Export command in package.json:bin section instead of valma.bin/ symlinking",
  },
  import: {
    type: "boolean",
    description: "Copy an existing, accessible command script as the new script",
  },
  skeleton: {
    type: "boolean", default: true,
    description: "If true will only draft a minimal script skeleton",
  },
  header: {
    type: "string", description: "Lines to place at the beginning of the script skeleton",
  },
  "exports-vlm": {
    type: "string", description: "Full exports.vlm source (as Object.assign-able object)",
  },
  describe: {
    type: "string", description: "Short description of the new command set as exports.describe",
  },
  introduction: {
    type: "string", description: "Full description of the new command set as exports.introduction",
  },
  disabled: {
    type: "string", description: "Full exports.disabled source (as function callback)",
  },
  builder: {
    type: "string", description: "Full exports.builder source (as function callback)",
  },
  handler: {
    type: "string", description: "Full exports.handler source (as function callback)",
  },
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const command = yargv.commandName;
  if (!command) throw new Error("commandName missing");
  const commandParts = command.replace(/\//g, "_").match(/^(\.)?(.*)$/);
  const commandExportName = `${commandParts[1] || ""}valma-${commandParts[2]}`;
  const scriptPath = `valma/${yargv.filename || `${commandParts[2]}.js`}`;
  let verb = "already exports";
  const import_ = yargv.import;
  let local = !yargv.export;
  while (!(vlm.packageConfig.bin || {})[commandExportName]) {
    const choices = [import_ ? "Import" : local ? "Create" : "Export", "skip",
      local ? "export instead" : "local instead"
    ];
    if (yargv.introduction) choices.push("help");
    const linkMessage = local
        ? `'valma.bin/${commandExportName}'`
        : `'package.json':bin["${commandExportName}"]`;
    const answer = await vlm.inquire([{
      message: `${import_ ? "Import" : local ? "Create" : "Export"
          } ${(yargv.brief && `'${yargv.brief}'`)
              || (import_ ? "an existing command" : local ? "a local command" : "a command")
          } script ${import_ ? "copy" : yargv.skeleton ? "skeleton" : "template"
          } as ${linkMessage} -> '${scriptPath}'?`,
      type: "list", name: "choice", default: choices[0], choices,
    }]);
    if (answer.choice === "skip") {
      verb = "doesn't export";
      break;
    }
    if (answer.choice === "help") {
      vlm.speak(yargv.introduction);
      vlm.info(`This step drafts a ${yargv.brief || (local ? "local" : "exported")
          } valma command script template\n`);
      continue;
    }
    if (answer.choice === "export instead") { local = false; continue; }
    if (answer.choice === "local instead") { local = true; continue; }
    if (vlm.shell.test("-e", scriptPath)
        && !await vlm.inquireConfirm(`Overwrite existing target '${scriptPath}' source?`)) {
      vlm.warn(`Not overwriting already existing script:`, vlm.theme.path(scriptPath));
    } else {
      vlm.shell.mkdir("-p", vlm.path.dirname(scriptPath));
      if (!yargv.import) {
        vlm.shell.ShellString(_draftSource(command, yargv)).to(scriptPath);
        vlm.shell.chmod("+x", scriptPath);
      } else {
        const sourcePath = await vlm.invoke(command, ["-T"]);
        if ((typeof sourcePath !== "string") || !vlm.shell.test("-f", sourcePath)) {
          throw new Error(`Could not find command '${command}' source file for importing`);
        }
        vlm.info("Importing existing script source:", vlm.theme.path(sourcePath));
        vlm.shell.cp(sourcePath, scriptPath);
      }
    }
    const symlinkPath = vlm.path.join("valma.bin", commandExportName);
    if (!local) {
      vlm.updatePackageConfig({ bin: { [commandExportName]: scriptPath } });
      verb = "now package.json.bin exports";
    } else if (!vlm.shell.test("-e", symlinkPath)) {
      vlm.shell.mkdir("-p", vlm.path.dirname(symlinkPath));
      vlm.shell.ln("-s", `../${scriptPath}`, symlinkPath);
      verb = "now locally valma.bin/ symlinks";
      break;
    } else {
      vlm.warn(`Cannot create local symlink at '${vlm.theme.path(symlinkPath)
          }' which already exists`);
      verb = "already symlinks";
      break;
    }
  }
  const message = `This workspace ${vlm.theme.bold(verb)} valma command '${
      vlm.theme.command(command)}'.`;
  if (verb === "already exports") {
    vlm.warn(message);
    vlm.instruct("You can edit the existing command script at:",
        vlm.theme.path(vlm.packageConfig.bin[commandExportName]));
  } else {
    vlm.info(message);
    vlm.instruct(`You can edit the command ${yargv.skeleton ? "skeleton" : "template"} at:`,
        vlm.theme.path(scriptPath));
  }
  return { local, verb, [command]: scriptPath };
};

function _draftSource (command, yargv) {
  // Emit shebang only if the command is a top-level command.
  const components = yargv.skeleton ? _draftSkeleton() : _draftExample();
  return `${(command[0] === ".") || command.includes("/.") ? "" : "#!/usr/bin/env vlm\n\n"
}${yargv.header || ""
}${!yargv["exports-vlm"] ? "" : `exports.vlm = ${yargv["exports-vlm"]};\n`
}exports.command = "${command}";
exports.brief = "${yargv.brief || ""}";
exports.describe = "${yargv.describe || yargv.brief || ""}";
exports.introduction = \`\${exports.describe}.${
    yargv.introduction ? `\n\n${yargv.introduction}` : ""}\`;

exports.disabled = ${yargv.disabled || components.disabled};
exports.builder = ${yargv.builder || components.builder};

exports.handler = ${yargv.handler || components.handler};
`;

  function _draftSkeleton () {
    return {
      disabled: "(yargs) => !yargs.vlm.packageConfig",
      builder:
`(yargs) => {
  const vlm = yargs.vlm;
  return yargs;
}`,
      handler:
`(yargv) => {
  const vlm = yargv.vlm;
  return true;
}`,
    };
  }

  function _draftExample () {
    return {
      disabled: "(yargs) => !yargs.vlm.packageConfig",
      builder:
`(yargs) => {
  const vlm = yargs.vlm;
  return yargs.options({
    name: {
      // See https://github.com/yargs/yargs/blob/HEAD/docs/api.md for yargs options
      type: "string", description: "current package name",
      default: vlm.packageConfig.name,
      // See https://github.com/SBoudrias/Inquirer.js/ about interactive attributes
      interactive: { type: "input", when: "if-undefined" },
    },
    color: {
      type: "string", description: "message color",
      default: "reset", choices: ["reset", "red", "black"],
      interactive: { type: "list", when: "always" },
    },
  });
}`,
      handler:
`(yargv) => {
  // Example template which displays the command name itself and package name where it is ran
  // Only enabled inside package
  const vlm = yargv.vlm;
  vlm.info(vlm.theme[yargv.color](\`This is '\${vlm.theme.command(command)}' running inside '\${
      vlm.theme.package(yargv.name)}'\`));
}`,
    };
  }
}
