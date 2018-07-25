#!/usr/bin/env node

const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");
const util = require("util");

const cardinal = require("cardinal");
const colors = require("colors/safe");
const inquirer = require("inquirer");
const minimatch = require("minimatch");
const semver = require("semver");
const shell = require("shelljs");
const yargs = require("yargs/yargs");
const yargsParser = require("yargs-parser").detailed;
const markdownify = require("../markdownify");
const deepExtend = require("@valos/tools/deepExtend").default;

cardinal.tomorrowNight = require("cardinal/themes/tomorrow-night");

Error.stackTraceLimit = Infinity;

/* eslint-disable vars-on-top, no-loop-func, no-restricted-syntax, no-cond-assign,
                  import/no-dynamic-require
*/

const globalVargs = __createVargs(process.argv.slice(2));

/*
   #    ######    ###
  # #   #     #    #
 #   #  #     #    #
#     # ######     #
####### #          #
#     # #          #
#     # #         ###
*/

const nodeCheck = ">=8.10.0";
const npmCheck = ">=5.0.0";

const defaultPaths = {
  poolBase: path.posix.resolve("."),
  poolDirectories: ["valma.bin/", "node_modules/.bin/"],
  globalPool: process.env.VLM_GLOBAL_POOL || (shell.which("vlm") || "").slice(0, -3),
};

const defaultCommandPrefix = "valma-";

// vlm - the Valma global API singleton - these are available to all command scripts via their
// yargs.vlm (in scripts exports.builder) as well as yargv.vlm (in scripts exports.handler).
const _vlm = globalVargs.vlm = {
  // Calls valma command with argv.
  // Any plain objects are expanded to boolean or parameterized flags depending on the value type.
  invoke,

  // TODO(iridian): Rename to delegate and clarify semantics with roughly following ideas:
  // Delegate initiates a parallel execution with only limited diagnostics messages and for which
  // the return value on completion is collected and returned to the delegate caller in a promise.
  // Catastrophic interactions may be prompted from the user, at least by vlm command delegates.


  // Executes a command and returns a promise of the command standard output as string.
  // Any plain objects are expanded to boolean or parameterized flags depending on the value type.
  execute,

  cwd: process.cwd(),

  // Immutable contents of package.json (contains pending updates as well)
  packageConfig: undefined,

  // Immutable contents of toolsets.json (contains pending updates as well)
  toolsetsConfig: undefined,

  getPackageConfig,
  getValmaConfig,
  getToolsetsConfig,

  // Registers pending updates to the package.json config file (immediately updates
  // vlm.packageConfig) which are written to file only immediately before valma execution exits or
  // an external command is about to be executed.
  // TODO(iridian): Improve the flush semantics, maybe to flush-on-subcommand-success - now it's
  // just silly.
  updatePackageConfig,

  // Registers pending updates to the toolsets.json config file (immediately updates
  // vlm.toolsetsConfig) which are written to file only immediately before valma execution exits or
  // an external command is about to be executed.
  // TODO(iridian): Improve the flush semantics, maybe to flush-on-subcommand-success - now it's
  // just silly.
  updateToolsetsConfig,

  // TODO(iridian): These should eventually be in a separate library. Fundamentally valma shouldn't
  // know about toolsets. OTOH valma type and the toolset scripts are part of valma package, so...
  getToolsetConfig,
  getToolConfig,
  confirmToolsetExists,
  updateToolsetConfig,
  updateToolConfig,
  createStandardToolsetOption,

  // Returns a list of available sub-command names which match the given command glob.
  listMatchingCommands,
  listAllMatchingCommands,

  // Enables usage of ANSI colors using the safe variant of Marak's colors
  // See https://github.com/Marak/colors.js
  colors,

  // The currently active theme.
  theme: colors,

  // Opens interactive inquirer prompt and returns a completion promise.
  // See https://github.com/SBoudrias/Inquirer.js/
  inquire: inquirer.createPromptModule(),

  // shelljs namespace of portable Unix commands
  // See https://github.com/shelljs/shelljs
  shell,

  // semver namespace of the npm semver parsing tools
  // See https://github.com/npm/node-semver
  semver,

  // minimatch namespace of the glob matching tools
  // See https://github.com/isaacs/minimatch
  minimatch,

  // node.js path.posix tools - all shell commands expect posix-style paths.
  // See https://nodejs.org/api/path.html
  path: path.posix,

  // forward to node require. Resolve non-absolute paths based on cwd.
  require: (() => {
    const ret = function vlmRequire (path_) {
      const resolvedPath = require.resolve(path_, { paths: [this.cwd] });
      if (!resolvedPath) {
        throw new Error(`Could not require.resolve path "${path_}" from cwd "${this.cwd}"`);
      }
      return require(resolvedPath);
    };
    ret.cache = require.cache;
    ret.resolve = (request, options) => require.resolve(request, { paths: [_vlm.cwd], ...options });
    ret.resolve.paths = function vlmRequireResolvePaths (request) {
      return require.resolve.paths(request);
    };
    return ret;
  })(),
  eval: function vlmEval (text) {
    // eslint-disable-next-line
    return eval(text);
  },

  // minimatch namespace of the glob matching tools
  // See https://github.com/isaacs/minimatch
  cardinal,
  cardinalDefault: { theme: cardinal.tomorrowNight, linenos: true },

  // Syntactic sugar

  tailor (...customizations) {
    return Object.assign(Object.create(this), ...customizations);
  },

  readFile: util.promisify(fs.readFile),
  async tryReadFile (...rest) {
    try { return await this.readFile(...rest); } catch (error) {
      return undefined;
    }
  },

  async inquireText (message, default_ = "") {
    return (await this.inquire({
      type: "input", name: "text", message, default: default_,
    })).text;
  },
  async inquireConfirm (message, default_ = true) {
    return (await _vlm.inquire({
      type: "confirm", name: "confirm", message, default: default_,
    })).confirm;
  },

  contextCommand: "vlm",
  contextIndex: undefined,
  getContextName () {
    return `${this.getContextIndexText()}${this.contextCommand}`;
  },
  getContextIndexText () {
    if (this.contextIndex === undefined) return "";
    if (!this.hasOwnProperty("contextIndex")) this.contextIndex = nextContextIndex++;
    return `[${this.contextIndex}] `;
  },

  render (type, ...rest) {
    const renderer = _renderers[type || ""];
    return renderer && rest.map(renderer);
  },

  ifVerbose (minimumVerbosity, callback) {
    function ssh () { return this; }
    if (this.verbosity < minimumVerbosity) {
      return {
        ifVerbose: ssh, log: ssh, echo: ssh, warn: ssh, error: ssh, exception: ssh, info: ssh,
        babble: ssh, expound: ssh,
      };
    }
    if (callback) callback.call(this);
    return this;
  },

  // Alias for console.log for unprocessed payload output directly to stdout
  log (...rest) {
    console.log(...rest);
    return this;
  },
  result (...rest) {
    const outputs = this.render(_vlm.vargv.results, ...rest.map(result =>
    // If the result has a heading, wrap the result inside an object so that the heading will be
    // rendered.
        ((typeof result === "object") && ((result || {})["..."] || {}).heading
            ? { result } : result)));
    if (outputs) {
      console.log(...outputs.map(value_ => ((typeof value_ === "string")
          ? value_
          : JSON.stringify(value_, null, 2))));
    }
    return this;
  },
  // Alias for console.warn for unprocessed diagnostics output directly to stderr
  speak (...rest) {
    console.warn(...rest);
    return this;
  },
  // Echo the valma wildcard matchings, invokations and external executions back to the user.
  // As a diagnostic message outputs to stderr where available.
  echo (...rest) {
    if (this.theme.echo) {
      if ((rest[0] || "").includes("<<")) this.echoIndent -= 2;
      console.warn(" ".repeat(this.echoIndent - 1), this.theme.echo(...rest));
      if ((rest[0] || "").includes(">>")) this.echoIndent += 2;
    }
    return this;
  },
  echoIndent: 4,
  lineLength: 71,

  // Diagnostics ops
  // These operations prefix the output with the command name and a verb describing the type of
  // the communication. They output to stderr where available.

  // When something unexpected happens which doesn't necessarily prevent the command from finishing
  // but might nevertheless be the root cause of errors later.
  // An example is a missing node_modules due to a lacking 'yarn install': this doesn't prevent
  // 'vlm --help' but would very likely be the cause for a 'cannot find command' error.
  // As a diagnostic message outputs to stderr where available.
  warn (msg, ...rest) {
    if (this.theme.warning) {
      console.warn(this.theme.warning(`${this.contextCommand} warns:`, msg), ...rest);
    }
    return this;
  },
  // When something is definitely wrong and operation cannot do everything that was expected
  // but might still complete.
  // As a diagnostic message outputs to stderr where available.
  error (msg, ...rest) {
    if (this.theme.error) {
      console.error(this.theme.error(`${this.getContextName()} laments:`, msg), ...rest);
    }
    return this;
  },
  // When something is catastrophically wrong and operation terminates immediately.
  // As a diagnostic message outputs to stderr where available.
  exception (error, ...rest) {
    if (this.theme.exception) {
      if (!error) {
        const dummy = {};
        Error.captureStackTrace(dummy);
        console.error(this.theme.exception(`vlm.exception: no error provided! ${dummy.stack}`));
      } else {
        console.error(this.theme.exception(`${this.getContextName()} panics: ${error}`), ...rest);
      }
    }
    return this;
  },
  // Info messages are mildly informative, non-noisy, unexceptional yet quite important. They
  // provide a steady stream of relevant information about reality an attuned devop expects to see.
  // In so doing they enable the devop to notice a divergence between reality and their own
  // expectations as soon as possible and take corrective action. In particular, they are used to:
  // 1. confirm choices that were made or tell about choices that will need to be made
  // 2. inform about execution pathways taken (like --dry-run or prod-vs-dev environment)
  // 3. communicate about the progress of the operation phases,
  // etc.
  // As a diagnostic message outputs to stderr where available.
  // Note! This is a divergence from Node console.info which outputs to stdout. However, diagnostics
  // messages need to go to stderr so that they can be separated from payload output and work
  // correctly with piping in general.
  info (msg, ...rest) {
    if (this.theme.info) {
      console.warn(this.theme.info(`${this.getContextName()} informs:`, msg), ...rest);
    }
    return this;
  },
  instruct (msg, ...rest) {
    if (this.theme.instruct) {
      console.warn(this.theme.instruct(`${this.getContextName()} instructs:`, msg), ...rest);
    }
    return this;
  },
  // Babble and expound are for learning and debugging. They are messages an attuned devop doesn't
  // want to see as they are noisy and don't fit any of the info criterias above.
  // They should always be gated behind --verbose.
  // Babble is for messages which take only couple lines.
  // As a diagnostic message outputs to stderr where available.
  babble (msg, ...rest) {
    if (this.theme.babble) {
      console.warn(this.theme.babble(`${this.getContextName()} babbles:`, msg), ...rest);
    }
    return this;
  },

  // Expound messages can be arbitrarily immense.
  // As a diagnostic message outputs to stderr where available.
  expound (msg, ...rest) {
    if (this.theme.expound) {
      console.warn(this.theme.expound(`${this.getContextName()} expounds:`, msg), ...rest);
    }
    return this;
  },

  // Implementation details
  _invoke,
  _peekReturnValue,
  _parseUntilLastPositional,
  _locateDependedPools,
  _refreshActivePools,
  _availablePools: [],
  _activePools: [],
  _selectActiveCommands,
  _determineIntrospection,
  _renderBuiltinHelp,
  _introspectCommands,
  _introspectPool,
  _fillVargvInteractively,
  _reloadPackageAndToolsetsConfigs,
  _getConfigAtPath,
  _flushPendingConfigWrites,
  _commitUpdates,
};

colors._setTheme = _setTheme;
function _setTheme (theme) {
  this.decoratorOf = function decoratorOf (rule) {
    return (...texts) => this.decorateWith([rule, "join"], texts);
  };
  this.decorateWith = function decorateWith (rule, texts) {
    try {
      if ((rule === undefined) || (rule === null)) return texts;
      if (typeof rule === "string") return this.decorateWith(this[rule], texts);
      if (typeof rule === "function") return rule.apply(this, texts.map(text => String(text)));
      if (Array.isArray(rule)) {
        return rule.reduce(
            (subTexts, ruleKey) => this.decorateWith(ruleKey, [].concat(subTexts)), texts);
      }
      return Object.keys(rule).reduce(
          (subTexts, ruleKey) => this.decorateWith(ruleKey, [rule[ruleKey]].concat(subTexts)),
          texts);
    } catch (error) {
      console.log("error while decorating with rule:", rule,
          "\n\ttexts:", JSON.stringify(texts, null, 2));
      throw error;
    }
  };
  Object.keys(theme).forEach(name => {
    const rule = theme[name];
    this[name] = (typeof rule === "function")
        ? rule
        : function decoratedStyle (...texts) { return this.decorateWith([rule, "join"], texts); };
  });
  return this;
}

const themes = {
  default: {
    none (...texts) { return texts; },
    join (...texts) { return [].concat(...texts).join(" "); },
    prefix (...texts) { return texts; },
    suffix (suffix, ...texts) { return texts.concat(suffix); },
    first (firstRule, first, ...texts) {
      if ((first === undefined) && !texts.length) return [];
      return [this.decorateWith(firstRule, [first])].concat(texts);
    },
    nonfirst (nonFirstRule, first, ...texts) {
      if ((first === undefined) && !texts.length) return [];
      if (!texts.length) return [first];
      return [first].concat(this.decorateWith(nonFirstRule, texts));
    },
    newlinesplit (...texts) {
      return [].concat(...[].concat(...texts).map(
        text => [].concat(...String(text).split("\n").map(line => [line, "\n"]))));
    },
    flatsplit (...texts) {
      return [].concat(...[].concat(...texts).map(
        text => String(text).split(" ")));
    },
    default (defaultValue, ...texts) {
      return texts.length > 1 || (texts[0] !== undefined) ? texts : [defaultValue];
    },
    cardinal (...textsAndOptions) {
      const options = { ..._vlm.cardinalDefault };
      const ret = [];
      for (const textOrOpt of textsAndOptions) {
        if (typeof textOrOpt === "string") {
          ret.push(textOrOpt && cardinal.highlight(textOrOpt, options));
        } else if (textOrOpt && (typeof textOrOpt === "object")) Object.assign(options, textOrOpt);
      }
      return ret;
    },

    echo: "dim",
    warning: ["bold", "yellow"],
    error: ["bold", "red"],
    exception: ["newlinesplit", { first: "error", nonfirst: "warning" }],
    info: "cyan",
    instruct: ["bold", "cyan"],
    babble: "cyan",
    expound: "cyan",
    argument: ["blue", "bold"],
    return: ["blue"],
    executable: ["flatsplit", { first: ["magenta"], nonfirst: "argument" }],
    command: ["flatsplit", { first: ["magenta", "bold"], nonfirst: "argument" }],
    overridden: ["strikethrough", "command"],
    package: ["dim", "bold", "yellow"],
    path: ["underline"],
    version: ["italic"],
  },
};

const activeColors = Object.create(colors);
_vlm.theme = activeColors._setTheme(themes.default);

themes.codeless = [
  "black", "red", "green", "yellow", "blue", "magenta", "cyan", "white", "gray", "grey",
  "bgBlack", "bgRed", "bgGreen", "bgYellow", "bgBlue", "bgMagenta", "bgCyan", "bgWhite",
  "reset", "bold", "dim", "italic", "underline", "inverse", "hidden", "strikethrough",
].reduce((theme, key) => {
  Object.defineProperty(theme, key,
      { value (...texts) { return texts.map(k => String(k)).join(" "); }, enumerable: true });
  return theme;
}, Object.create(activeColors));

const _renderers = {
  omit: null,
  json: (value) => JSON.stringify(value, null, 2),
  "json-compact": (value) => JSON.stringify(value),
  "markdown-cli": (value) => markdownify.default(value, _vlm.theme),
  "markdown-json": (value) => markdownify.extendWithLayouts(value),
  markdown: (value) => markdownify.default(value, themes.codeless),
};

module.exports = {
  command: "vlm [--help] [-<flagchars>] [--<flag>...] [--<option>=<value>..] [command]",
  describe: "Dispatch a valma command to its command script",
  introduction: { "...": "valma/docs/INTRODUCTION.vdon" },

  builder: (vargs_) => vargs_
  //    .usage(module.exports.command, module.exports.describe, iy => iy)
      .options({
        p: {
          group: "Valma root options:",
          alias: "pools", type: "boolean", global: false,
          description: "Show overridden pool commands and empty pool headers.",
        },
        s: {
          group: "Valma root options:",
          alias: "silence", type: "boolean", global: false,
          description: "Silence all console output except errors and potential results.",
          causes: [
            "no-echos", "no-logs", "no-infos", "no-instructs", "no-warnings", "no-babbles",
            "no-expounds"
          ],
        },
        v: {
          group: "Valma root options:",
          alias: "verbose", count: true, global: false,
          description: "Be noisy. -vv... -> be more noisy.",
        },
        vlm: {
          group: "Valma root options:",
          type: "object", global: false,
          description: "Set global vlm object fields (f.ex. --vlm.lineLength=60)",
        },
        echos: {
          group: "Valma root options:",
          type: "boolean", global: false, default: true,
          description: "Show echo messages",
        },
        logs: {
          group: "Valma root options:",
          type: "boolean", global: false, default: true,
          description: "Show log messages",
        },
        infos: {
          group: "Valma root options:",
          type: "boolean", global: false, default: true,
          description: "Show info messages",
        },
        instructs: {
          group: "Valma root options:",
          type: "boolean", global: false, default: true,
          description: "Show instruct messages",
        },
        warnings: {
          group: "Valma root options:",
          type: "boolean", global: false, default: true,
          description: "Show warning messages",
        },
        babbles: {
          group: "Valma root options:",
          type: "boolean", global: false, default: true,
          description: "Show babble messages",
        },
        expounds: {
          group: "Valma root options:",
          type: "boolean", global: false, default: true,
          description: "Show expound messages",
        },
        results: {
          group: "Valma root options:",
          type: "string", global: false, default: "markdown-cli", choices: Object.keys(_renderers),
          description: "Show result value in output",
        },
        json: {
          group: "Valma root options:",
          type: "boolean", global: false,
          description: "Alias for --results=json for rendering result as JSON into standard output",
          causes: "results=json",
        },
        markdown: {
          group: "Valma root options:",
          type: "boolean", global: false,
          description: "Alias for --results=markdown for rendering result as raw unstyled markdown",
          causes: "results=markdown",
        },
        interactive: {
          group: "Valma root options:",
          type: "boolean", default: true, global: false,
          description: "Prompt for missing fields. If false then missing required fields will throw"
        },
        promote: {
          group: "Valma root options:",
          type: "boolean", default: true, global: false,
          description: "Promote to 'vlm' in the most specific pool available via forward",
        },
        "npm-config-env": {
          group: "Valma root options:",
          type: "boolean", default: true, global: false,
          description: "Add npm global environment if they are missing",
        },
        "package-config-env": {
          group: "Valma root options:",
          type: "boolean", default: false, global: false,
          description: "Add npm package environment variables if they are missing (not implemented)",
        },
        forward: {
          group: "Valma root options:",
          type: "boolean", default: true, global: false,
          description: "Allow vlm forwarding due to promote, node-env or need to load vlm path",
        },
        "command-prefix": {
          group: "Valma root options:",
          type: "string", default: defaultCommandPrefix, global: false,
          description: "The command prefix valma uses to recognize command script files.",
        },
        "pool-base": {
          group: "Valma root options:",
          type: "string", default: defaultPaths.poolBase, global: false,
          description: "Initial pool base path for gathering pools through all parent paths.",
        },
        "pool-directories": {
          group: "Valma root options:", array: true,
          type: "string", default: defaultPaths.poolDirectories, global: false,
          description: "Pool directories are appended to current pool base to locate pools",
        },
        "global-pool": {
          group: "Valma root options:",
          type: "string", default: defaultPaths.globalPool || null, global: false,
          description: "Global pool path is the last pool to be searched",
        },
        "bash-completion": {
          group: "Valma root options:",
          type: "boolean", global: false,
          description: "Output bash completion script",
        },
      }),
  handler, // Defined below.
};

function __addUniversalOptions (vargs_,
      { strict = true, global = false, hidden = false, theme = themes.codeless }) {
  function _postProcess (options) {
    Object.keys(options).forEach(name => {
      if (options[name].hidden) delete options[name].group;
    });
    return options;
  }
  const hiddenGroup = `Universal options${!hidden ? "" : ` ('${theme.command("vlm -h <cmd>")
      }' for full list)`}:`;
  return vargs_
      .strict(strict)
      .help(false)
      .version(false)
      .wrap(vargs_.terminalWidth() < 140 ? vargs_.terminalWidth() : 140)
      .option(_postProcess({
        a: {
          alias: theme.argument("match-all"),
          group: hiddenGroup, type: "boolean", global,
          description: "Include hidden and disabled commands in /all/ matchings",
        },
        d: {
          alias: theme.argument("dry-run"),
          group: hiddenGroup, type: "boolean", global,
          description: "Do not execute but display all the matching command(s)",
        },
        h: {
          alias: "help",
          group: hiddenGroup, type: "boolean", global,
          description: "Show the main help of the command",
        },
        N: {
          alias: theme.argument("show-name"),
          group: "Universal options:", type: "boolean", global, hidden,
          description: "Show the command (N)ame column",
        },
        U: {
          alias: theme.argument("show-usage"),
          group: "Universal options:", type: "boolean", global, hidden,
          description: "Show the command (U)sage column",
        },
        D: {
          alias: theme.argument("show-description"),
          group: "Universal options:", type: "boolean", global, hidden,
          description: "Show the command one-liner (D)escription column",
        },
        P: {
          alias: theme.argument("show-package"),
          group: "Universal options:", type: "boolean", global, hidden,
          description: "Show the command (P)ackage name column",
        },
        V: {
          alias: [theme.argument("show-version"), theme.argument("version")],
          group: "Universal options:", type: "boolean", global, hidden,
          description: "Show the command (V)ersion column",
        },
        O: {
          alias: theme.argument("show-pool"),
          group: "Universal options:", type: "boolean", global, hidden,
          description: "Show the command source p(O)ol column",
        },
        F: {
          alias: theme.argument("show-file"),
          group: "Universal options:", type: "boolean", global, hidden,
          description: "Show the command (F)ile path column",
        },
        R: {
          alias: theme.argument("show-resolved"),
          group: "Universal options:", type: "boolean", global, hidden,
          description: "Show the command symlink-(R)esolved path column",
        },
        I: {
          alias: theme.argument("show-introduction"),
          group: "Universal options:", type: "boolean", global, hidden,
          description: "Output the full (I)ntroduction of the command",
        },
        S: {
          alias: theme.argument("show-source"),
          group: "Universal options:", type: "boolean", global, hidden,
          description: "Output the script (S)ource code of the command",
        },
      }));
}

/*
  ###                               ##
   #     #    #     #     #####    #  #      #    #    ##       #    #    #
   #     ##   #     #       #       ##       ##  ##   #  #      #    ##   #
   #     # #  #     #       #      ###       # ## #  #    #     #    # #  #
   #     #  # #     #       #     #   # #    #    #  ######     #    #  # #
   #     #   ##     #       #     #    #     #    #  #    #     #    #   ##
  ###    #    #     #       #      #### #    #    #  #    #     #    #    #
*/

_vlm.isCompleting = (process.argv[2] === "--get-yargs-completions");
const processArgv = _vlm.isCompleting ? process.argv.slice(3) : process.argv.slice(2);

let nextContextIndex;

__addUniversalOptions(globalVargs, { strict: !_vlm.isCompleting, hidden: false });
module.exports.builder(globalVargs);
_vlm.vargs = globalVargs;
_vlm.vargv = _vlm._parseUntilLastPositional(processArgv, module.exports.command);

const _commandPrefix = _vlm.vargv.commandPrefix;

_vlm.verbosity = _vlm.isCompleting ? 0 : _vlm.vargv.verbose;
_vlm.interactive = _vlm.isCompleting ? 0 : _vlm.vargv.interactive;
if (!_vlm.vargv.echos || _vlm.isCompleting) _vlm.echo = function noEcho () { return this; };
else {
  nextContextIndex = 0;
  _vlm.contextIndex = nextContextIndex++;
}
if (!_vlm.vargv.logs || _vlm.isCompleting) _vlm.log = function noLog () { return this; };
if (!_vlm.vargv.infos || _vlm.isCompleting) _vlm.info = function noInfo () { return this; };
if (!_vlm.vargv.instructs || _vlm.isCompleting) _vlm.instruct = function noIns () { return this; };
if (!_vlm.vargv.warnings || _vlm.isCompleting) _vlm.warn = function noWarning () { return this; };
if (!_vlm.vargv.babbles || _vlm.isCompleting) _vlm.babble = function noBabble () { return this; };
if (!_vlm.vargv.expounds || _vlm.isCompleting) _vlm.expound = function noExpou () { return this; };

_vlm.ifVerbose(1).babble("phase 1, init:", "determine global options and available pools.",
    `\n\tcommand: ${_vlm.theme.command(_vlm.vargv.command)
        }, verbosity: ${_vlm.verbosity}, interactive: ${_vlm.interactive}, echo: ${_vlm.vargv.echo}`,
    "\n\tprocess.argv:", ...process.argv
).ifVerbose(2).babble("paths:", "cwd:", process.cwd(),
    "\n\tprocess.env.VLM_GLOBAL_POOL:", process.env.VLM_GLOBAL_POOL,
    "\n\tprocess.env.VLM_PATH:", process.env.VLM_PATH,
    "\n\tprocess.env.PATH:", process.env.PATH,
    "\n\tdefaultPaths:", JSON.stringify(defaultPaths)
).ifVerbose(3).expound("global options:", _vlm.vargv);

// When a command begins with ./ or contains the command prefix (if it is non-empty) it is
// considered a direct file valma command. It's parent directory is made the initial "file" pool.
let poolBase = _vlm.vargv.poolBase;
if ((_commandPrefix && (_vlm.vargv.command || "").includes(_commandPrefix))
    || (_vlm.vargv.command || "").slice(0, 2) === "./") {
  if (_vlm.vargv.isCompleting) process.exit(0); // Let bash filename completion do its thing.
  const commandMatcher = new RegExp(`(.*/)?(\\.?)${_commandPrefix}(.*?)(.js)?$`);
  const match = _vlm.vargv.command.match(commandMatcher);
  _vlm.vargv.command = match ? `${match[2]}${match[3]}` : "";
  const filePoolPath = _vlm.path.resolve((match && match[1]) || "");
  _vlm._availablePools.push({ name: "file", path: filePoolPath });
  poolBase = filePoolPath;
}
_vlm._availablePools.push(..._vlm._locateDependedPools(poolBase, _vlm.vargv.poolDirectories));
_vlm._availablePools.push({ name: "global", path: _vlm.vargv.globalPool });

_vlm.ifVerbose(2)
    .expound("available pools:", _vlm._availablePools);

const packageConfigStatus = {
  path: _vlm.path.join(process.cwd(), "package.json"), updated: false,
};
const toolsetsConfigStatus = {
  path: _vlm.path.join(process.cwd(), "toolsets.json"), updated: false,
};

// Allow --vlm to override any implicit vlm modifications (ie. --vlm.verbosity=100 overrides -v)
if (_vlm.vargv.vlmOption) {
  deepExtend(_vlm, _vlm.vargv.vlmOption);
}

process.on("SIGINT", () => {
  _vlm.exception("interrupted by SIGINT:", "killing all child processes");
  setTimeout(() => process.exit(-1));
});
process.on("SIGTERM", () => {
  _vlm.exception("terminated by SIGINT:", "killing all child processes");
  setTimeout(() => process.exit(-1));
});

module.exports
    .handler(_vlm.vargv)
    .then(result => {
      if (result !== undefined) {
        _vlm.result(result);
        process.exit(0);
      }
    })
    .catch(error => {
      if (error !== undefined) {
        _vlm.exception(error.stack || error);
      }
      process.exit(typeof error === "number" ? error : ((error && error.code) || -1));
    });

// Only function definitions from hereon.

async function handler (vargv) {
  // Phase21: Pre-load args with so-far empty pools to detect fully builtin commands (which don't
  // need forwarding).
  const fullyBuiltin = _vlm.isCompleting || !vargv.command;
  const contextVLM = vargv.vlm;

  const needNPM = !fullyBuiltin && vargv.npmConfigEnv && !process.env.npm_package_name;
  const needVLMPath = !fullyBuiltin && !process.env.VLM_PATH;
  const needForward = !fullyBuiltin && needVLMPath;

  contextVLM.ifVerbose(1)
      .babble("phase 2, main:", "determine active commands, forwards, and do validations.",
          "\n\tfullyBuiltin:", fullyBuiltin, ", needNPM:", needNPM, ", needVLMPath:", needVLMPath,
              ", needForward:", needForward);

  // Phase 2: Load pools and forward to 'vlm' if needed (if a more specific 'vlm' is found or if the
  // node environment or 'vlm' needs to be loaded)
  const forwardPool = contextVLM._refreshActivePools((pool, poolHasVLM, specificEnoughVLMSeen) => {
    contextVLM.ifVerbose(3)
        .babble(`evaluating pool ${pool.path}`, "has 'vlm':", poolHasVLM,
            "vlm seen:", specificEnoughVLMSeen);
    if (!_vlm.vargv.forward || fullyBuiltin || !poolHasVLM
        || (specificEnoughVLMSeen && !needForward)
        || (!specificEnoughVLMSeen && !vargv.promote)) return undefined;
    Object.assign(process.env, {
      VLM_PATH: process.env.VLM_PATH || pool.path,
      VLM_GLOBAL_POOL: process.env.VLM_GLOBAL_POOL || _vlm.vargv.globalPool,
      INIT_CWD: process.cwd(),
      PATH: `${[
        pool.path,
        contextVLM._activePools[contextVLM._activePools.length - 1].path,
        contextVLM._activePools[0].path,
      ].join(":")}:${process.env.PATH}`,
      _: contextVLM.path.join(pool.path, "vlm"),
    });
    const myRealVLM = fs.realpathSync(process.argv[1]);
    pool.vlmPath = path.join(pool.path, "vlm");
    const forwardRealVLM = fs.realpathSync(pool.vlmPath);
    if (myRealVLM === forwardRealVLM) return undefined;
    contextVLM.ifVerbose(1)
        .info(`forwarding to vlm at require('${contextVLM.theme.path(pool.vlmPath)}')`,
            "via pool", contextVLM.theme.path(pool.path),
            "\n\treal path:", contextVLM.theme.path(forwardRealVLM), `(current vlm "${
                contextVLM.theme.path(myRealVLM)})"`);
    return pool;
  });
  if (forwardPool) {
    // Call is handled by a forward require to another valma.
    process.argv[1] = forwardPool.vlmPath;
    require(forwardPool.vlmPath);
    return undefined;
  }
  if (needNPM) {
    await __loadNPMConfigVariables();
  }

  if (_vlm.isCompleting) {
    // skip remainder of init so that possible warning messages dont clutter completions
    contextVLM.invoke(vargv.command, vargv._,
        { suppressOutermostEcho: true, processArgs: false });
    return null;
  }

  // Do validations.

  contextVLM.ifVerbose(2)
      .expound("activePools:",
          ...[].concat(...contextVLM._activePools.map(pool => ["\n", Object.assign({}, pool, {
            listing: contextVLM.verbosity < 3
                ? "<hidden>"
                : Array.isArray(pool.listing) && pool.listing.map(entry => entry.name)
          })])),
          "\n");

  if (!fullyBuiltin && needVLMPath && !process.env.VLM_PATH) {
    contextVLM.error("could not find 'vlm' in PATH or in any pool");
    process.exit(-1);
  }

  if (!semver.satisfies(process.versions.node, nodeCheck)) {
    contextVLM.warn(`your node version is old (${process.versions.node}):`,
        "recommended to have at least", nodeCheck);
  }

  contextVLM._reloadPackageAndToolsetsConfigs();

  if (!process.env.npm_config_user_agent) {
    if (needNPM && contextVLM.packageConfig) {
      contextVLM.warn("could not load NPM config environment variables");
    }
  } else {
    const npmVersion = (process.env.npm_config_user_agent || "").match(/npm\/([^ ]*) /);
    if (npmVersion && !semver.satisfies(npmVersion[1], npmCheck)) {
      contextVLM.warn(`your npm version is old (${npmVersion[1]})`,
          "recommended to have at least", npmCheck);
    }
  }

  return await contextVLM.invoke(vargv.command, vargv._,
      { suppressOutermostEcho: true, processArgs: false, flushConfigWrites: true });

  /*
  const subVLM = Object.create(contextVLM);
  subVLM.contextVargv = vargv;
  const maybeRet = subVLM.invoke(vargv.command, vargv._);
  subVLM.invoke = invokeWithEcho;
  const ret = await maybeRet;
  subVLM._flushPendingConfigWrites();
  return ret;
  */
}

/*
                                #     #
  ####     ##    #       #      #     #    ##    #       #    #    ##
 #    #   #  #   #       #      #     #   #  #   #       ##  ##   #  #
 #       #    #  #       #      #     #  #    #  #       # ## #  #    #
 #       ######  #       #       #   #   ######  #       #    #  ######
 #    #  #    #  #       #        # #    #    #  #       #    #  #    #
  ####   #    #  ######  ######    #     #    #  ######  #    #  #    #
*/

async function invoke (commandSelector, args, options = {}) {
  const invokeVLM = Object.create(this);
  invokeVLM.contextVLM = this;
  // Remove everything after space so that exports.command can be given as commandSelector as-is
  // (these often have yargs usage arguments after the command selector itself).
  const selector = commandSelector && commandSelector.split(" ")[0];
  const argv = (options.processArgs !== false) ? __processArgs(args) : args;
  if (!options.suppressOutermostEcho) {
    invokeVLM.echo(`${this.getContextIndexText()}>> ${invokeVLM.getContextIndexText()}vlm`,
        invokeVLM.theme.command(selector, ...argv));
  }
  let echoResult;
  try {
    const ret = await invokeVLM._invoke(selector, argv);
    echoResult = invokeVLM._peekReturnValue(ret, 71);
    return ret;
  } catch (error) {
    echoResult = invokeVLM.theme.error("exception:", String(error));
    throw error;
  } finally {
    if (!options.suppressOutermostEcho) {
      invokeVLM.echo(`${this.getContextIndexText()}<< ${invokeVLM.getContextIndexText()}vlm`,
          `${invokeVLM.theme.command(selector)}:`, echoResult);
    }
    if (options.flushConfigWrites) {
      invokeVLM._flushPendingConfigWrites();
      this._reloadPackageAndToolsetsConfigs();
    }
  }
}

function _peekReturnValue (value, clipLength) {
  let ret;
  if ((typeof value === "object") && value && !Array.isArray(value)
      && Object.getPrototypeOf(value) !== Object.prototype) {
    ret = "<complex object>";
  } else if (value === undefined) {
    ret = "<undefined>";
  } else {
    ret = JSON.stringify(value);
  }
  return this.theme.return(ret.length <= clipLength ? ret : `${ret.slice(0, clipLength)}...`);
}

async function _invoke (commandSelector, argv) {
  if (!Array.isArray(argv)) {
    throw new Error(`vlm.invoke: argv must be an array, got ${typeof argv}`);
  }
  if (!this || !this.ifVerbose) {
    throw new Error(`vlm.invoke: 'this' must be a valid vlm context`);
  }

  const contextVargv = this.contextVLM.vargv;
  const commandGlob = __underToSlash((contextVargv.matchAll || this.isCompleting)
      ? __globFromPrefixSelector(commandSelector, contextVargv.matchAll)
      : __globFromExactSelector(commandSelector || "*"));
  const isWildcardCommand = !commandSelector || (commandSelector.indexOf("*") !== -1);
  const introspect = this.contextVLM._determineIntrospection(
      module.exports, commandSelector, isWildcardCommand, true);

  // Phase 3: filter available command pools against the command glob

  this.ifVerbose(1)
      .babble("phase 3, invoke", this.theme.command(commandGlob, ...argv),
          "\n\tisWildcard:", isWildcardCommand, ", introspect options:", !!introspect);
  this.ifVerbose(2)
      .expound("introspect:", introspect)
      .expound("contextVargv:", { ...contextVargv, vlm: "<hidden>" });

  const activeCommands = this._selectActiveCommands(commandGlob, argv, introspect);

  if (this.isCompleting || contextVargv.bashCompletion) {
    globalVargs.completion("bash-completion", (current, argvSoFar) => {
      const rule = __underToSlash(__globFromPrefixSelector(argvSoFar._[1], argvSoFar.matchAll));
      const ret = [].concat(...this._activePools.map(pool => pool.listing
          .filter(node => !__isDirectory(node) && minimatch(__underToSlash(node.name || ""), rule,
              { dot: argvSoFar.matchAll }))
          .map(node => __valmaCommandFromPath(node.name))));
      return ret;
    });
    globalVargs.parse(contextVargv.bashCompletion ? ["bash-completion"] : process.argv.slice(2));
    return 0;
  }

  this.ifVerbose(2)
      .expound("activeCommands: {", ...Object.keys(activeCommands).map(
              key => `\n\t\t${key}: ${activeCommands[key].filePath}`),
          "\n\t}");

  if (introspect) {
    return introspect.builtinHelp
        ? this._renderBuiltinHelp(introspect)
        : this._introspectCommands(introspect, activeCommands, commandGlob,
            isWildcardCommand, contextVargv.matchAll);
  }

  if (!isWildcardCommand) {
    if (!Object.keys(activeCommands).length) {
      this.error(
          `cannot find command '${this.theme.command(commandSelector)}' from active pools:`,
          ...this._activePools.map(
              activePool => `\n\t"${this.path.join(activePool.path, commandGlob)}"`));
      return -1;
    }
    Object.values(activeCommands)[0].vlm.contextIndex += 0;
  }

  // Phase 4: Dispatch the command(s)

  const dryRunCommands = contextVargv.dryRun && {};
  let ret = [];

  this.ifVerbose(1)
      .babble("phase 4, dispatch:", ...(dryRunCommands ? ["--dry-run"] : []),
          this.theme.command(commandGlob, ...argv),
          "\n\tactive commands:",
          ...Object.keys(activeCommands).map(c => this.theme.command(c)));
  globalVargs.help();

  // Reverse order to have matching global command names execute first (still obeying overrides)
  for (const activePool of this._activePools.slice().reverse()) {
    for (const commandName of Object.keys(activePool.commands).sort()) {
      const activeCommand = activeCommands[commandName];
      if (!activeCommand) continue;
      const module = activeCommand.module;
      delete activeCommands[commandName];
      if (dryRunCommands) {
        dryRunCommands[commandName] = activeCommand;
        continue;
      }
      if (!module) {
        this.error(`missing symlink target for`, this.theme.command(commandName),
            "ignoring command script at", activeCommand.filePath);
        continue;
      }

      const subVLM = activeCommand.vlm;
      subVLM.vargv = subVLM._parseUntilLastPositional(argv, module.command);
      const subIntrospect = subVLM._determineIntrospection(module, commandName);

      this.ifVerbose(3)
          .babble("parsed:", this.theme.command(commandName, ...argv),
              activeCommand.disabled ? `: disabled, ${activeCommand.disabled}` : ""
      ).ifVerbose(4)
          .expound("\tsubArgv:", subVLM.vargv)
          .expound("\tsubIntrospect:", subIntrospect);

      if (subIntrospect) {
        ret = ret.concat(subIntrospect.builtinHelp
            ? activeCommand.vlm._renderBuiltinHelp(subIntrospect)
            : this._introspectCommands(subIntrospect, { [commandName]: activeCommand },
                commandSelector, isWildcardCommand, subVLM.vargv.matchAll));
      } else if (isWildcardCommand && activeCommand.disabled) {
        this.ifVerbose(1)
            .info(`Skipping disabled command '${this.theme.command(commandName)}'`,
                `during wildcard invokation (${activeCommand.disabled})`);
        continue;
      } else {
        if (activeCommand.disabled) {
          this.warn(`Invoking a disabled command '${commandName}' explicitly`,
              `(${activeCommand.disabled})`);
        }
        try {
          if (isWildcardCommand) {
            this.echo(`${this.getContextIndexText()}>>* ${subVLM.getContextIndexText()}vlm`,
                this.theme.command(commandName, ...argv));
          }
          await subVLM._fillVargvInteractively();
          if (subVLM.toolset) {
            const requiresPath = ["commands", commandName, "requires"];
            const tool = subVLM.tool;
            const requires = tool
                ? subVLM.getToolConfig(subVLM.toolset, tool, ...requiresPath)
                : subVLM.getToolsetConfig(subVLM.toolset, ...requiresPath);
            let requireResult = true;
            for (let i = 0; requireResult && (i !== (requires || []).length); ++i) {
              const header = `tool${tool ? "Config" : "setConfig"}.requires[${i}] of ${
                this.theme.command(commandName)}`;
              try {
                this.echo(`${subVLM.getContextIndexText()}>>>? ${header}`, "via",
                    ...(tool ? ["tool", this.theme.package(tool), "of"] : []),
                    "toolset", this.theme.package(subVLM.toolset));
                requireResult = await subVLM.execute(requires[i]);
              } catch (error) {
                requireResult = this.error(`<exception>: ${String(error)}`);
                throw error;
              } finally {
                this.echo(`${subVLM.getContextIndexText()}<<<? ${header}:`,
                    this._peekReturnValue(requireResult, 51));
              }
              if (!requireResult) {
                const message = `'${this.theme.command(commandName)
                    }' as it can't satisfy requires[${i}]: ${this.theme.executable(requires[i])}`;
                if (!isWildcardCommand) {
                  throw new Error(`Failed command ${message}`);
                }
                this.error(`Skipping command ${message}`);
                ret.push(`Skipped command ${message}`);
              }
            }
            if (!requireResult) continue;
          }
          const simpleCommand = commandName.match(/\.?([^/]*)$/)[1];
          const detailCommandPrefix = commandName.replace(/.?[^/]*$/, `.${simpleCommand}`);
          const preCommands = `${detailCommandPrefix}/.pre/**/*`;
          if (subVLM.listMatchingCommands(preCommands).length) {
            await subVLM.invoke(preCommands);
          }
          ret.push(await module.handler(subVLM.vargv));
          const postCommands = `${detailCommandPrefix}/.post/**/*`;
          if (subVLM.listMatchingCommands(preCommands).length) {
            await subVLM.invoke(postCommands);
          }
        } finally {
          if (this.echo && (commandName !== commandSelector)) {
            let retValue = JSON.stringify(ret[ret.length - 1]);
            if (retValue === undefined) retValue = "undefined";
            if (isWildcardCommand) {
              this.echo(`${this.getContextIndexText()}<<* ${subVLM.getContextIndexText()}vlm`,
                  `${this.theme.command(commandName)}:`,
                  this._peekReturnValue(retValue, 40));
            }
          }
        }
      }
    }
  }
  if (dryRunCommands) {
    this._introspectCommands(this.contextVLM._determineIntrospection(module),
        dryRunCommands, commandSelector, isWildcardCommand, contextVargv.matchAll);
  }
  return isWildcardCommand ? ret : ret[0];
}

/*
######
#     #  ######   #####    ##       #    #
#     #  #          #     #  #      #    #
#     #  #####      #    #    #     #    #
#     #  #          #    ######     #    #
#     #  #          #    #    #     #    #
######   ######     #    #    #     #    ######
*/

function _parseUntilLastPositional (argv_, commandUsage) {
  const endIndex = argv_.findIndex(arg => (arg === "--") || (arg[0] !== "-"));
  const args = argv_.slice(0, (endIndex === -1) ? undefined : endIndex);
  const ret = this.vargs.parse(args);
  if (ret.vlm) ret.vlmOption = ret.vlm;
  ret.vlm = this;
  const usageParts = commandUsage.split(" ");
  const positionals = usageParts.slice(1).filter(param => (param[1] !== "-"));
  ret._ = (endIndex === -1) ? [] : argv_.slice(endIndex);
  for (const positional of positionals) {
    const variadic = positional.match(/^.(.*)\.\..$/);
    if (variadic) {
      ret[variadic[1]] = ret._.splice(0, ret._.indexOf("--") + 1 || 100000);
      break;
    }
    ret[positional.slice(1, -1)] = ret._.shift();
  }
  return ret;
}

// eslint-disable-next-line no-bitwise
function __isDirectory (candidate) { return candidate.mode & 0x4000; }

// If the command begins with a dot, insert the command prefix _after_ the dot; this is useful
// as directories beginning with . don't match /**/ and * glob matchers and can be considered
// implementation detail.
function __globFromExactSelector (commandBody) {
  return !commandBody ? _commandPrefix
      : (commandBody[0] === ".") ? `.${_commandPrefix}${commandBody.slice(1)}`
      : `${_commandPrefix}${commandBody}`;
}

function __globFromPrefixSelector (partialCommand = "", matchAll) {
  return matchAll && !((partialCommand || "")[0] === ".")
      ? `{.,}${_commandPrefix}${partialCommand || ""}{,*/**/}*`
      : `${__globFromExactSelector(partialCommand)}{,*/**/}*`;
}

function __valmaCommandFromPath (pathname) {
  const match = pathname.match(new RegExp(`(\\.?)${_commandPrefix}(.*)`));
  return __underToSlash(`${match[1]}${match[2]}`);
}

function __underToSlash (text = "") {
  if (typeof text !== "string") throw new Error(`expected string, got: ${JSON.stringify(text)}`);
  return text.replace(/_/g, "/");
}

function _locateDependedPools (initialPoolBase, poolDirectories) {
  // TODO(iridian): eventually make less singletony to allow for different sub-invokation
  // current working diretory execution contexts (now fixed in the initial cwd)
  let pathBase = initialPoolBase;
  const ret = [];
  while (pathBase) {
    poolDirectories.forEach(candidate => {
      const poolPath = this.path.join(pathBase, candidate);
      if (shell.test("-d", poolPath)) {
        ret.push({ name: `${pathBase.match(/([^/]*)\/?$/)[1]}/${candidate}`, path: poolPath });
        return;
      }
      const packageJsonPath = this.path.join(pathBase, "package.json");
      if (candidate.match(/^node_modules/) && shell.test("-f", packageJsonPath)) {
        this.warn(`node_modules missing for ${packageJsonPath}!`,
            "\nSome dependent commands will likely be missing.",
            `Run '${this.theme.executable("yarn install")
                }' to make dependent commands available.\n`);
      }
    });
    if (pathBase === "/") break;
    pathBase = this.path.join(pathBase, "..");
  }
  return ret;
}

function _refreshActivePools (tryShortCircuit) {
  // TODO(iridian): same as _locateDependedPools: make _activePools properly context dependent.
  // Now splicing so that only the root _vlm._activePools is affected.
  this._activePools.splice(0, -1);
  let specificEnoughVLMSeen = false;
  for (const pool of this._availablePools) {
    if (!pool.path || !shell.test("-d", pool.path)) continue;
    let poolHasVLM = false;
    pool.listing = shell.ls("-lAR", pool.path)
        .filter(file => {
          if (file.name.slice(0, 5) === "valma" || file.name.slice(0, 6) === ".valma") return true;
          if (file.name === "vlm") poolHasVLM = true;
          return false;
        });
    this._activePools.push(pool);
    if (process.argv[1].indexOf(pool.path) === 0) specificEnoughVLMSeen = true;
    const shortCircuit = tryShortCircuit
        && tryShortCircuit(pool, poolHasVLM, specificEnoughVLMSeen);
    if (shortCircuit) return shortCircuit;
  }
  return undefined;
}

function _selectActiveCommands (commandGlob, argv, introspect) {
  if (introspect && introspect.identityPool) return introspect.identityPool.commands;
  const ret = {};
  for (const pool of this._activePools) {
    if (!pool.commands) pool.commands = {};
    pool.stats = {};
    pool.listing.forEach(file => {
      const normalizedName = __underToSlash(file.name);
      const matches = minimatch(normalizedName, commandGlob, { dot: this.vargv.matchAll });
      this.ifVerbose(3)
          .babble(`evaluating file ${file.name}`, "matches:", matches, "vs glob:", commandGlob,
          ", dir:", __isDirectory(file), ", normalizedName:", normalizedName);
      if (!matches) {
        pool.stats.nonmatching = (pool.stats.nonmatching || 0) + 1;
        return;
      }
      if (__isDirectory(file)) return;
      const commandName = __valmaCommandFromPath(file.name);
      const poolCommand = pool.commands[commandName] || (pool.commands[commandName] = {
        name: commandName, pool, file, filePath: this.path.join(pool.path, file.name),
      });
      if (ret[commandName]) {
        pool.stats.overridden = (pool.stats.overridden || 0) + 1;
        return;
      }
      if (!poolCommand.module && shell.test("-e", poolCommand.filePath)) {
        poolCommand.module = require(poolCommand.filePath);
        this.ifVerbose(3)
            .babble(`    command ${commandName} module found at path`, poolCommand.filePath);
      }
      const module = poolCommand.module;
      if (!module || !module.command || !module.describe || !module.handler) {
        if (this.isCompleting || introspect || this.vargv.dryRun) {
          ret[commandName] = { ...poolCommand };
          return;
        }
        throw new Error(`invalid command '${commandName}' script file '${poolCommand.filePath
            }': can't open for reading or exports.command, ...describe or ...handler missing`);
      }

      const subVargs = __createVargs(argv);
      __addUniversalOptions(subVargs, { global: true, hidden: !_vlm.vargv.help });

      subVargs.vlm = Object.assign(Object.create(this),
          module.vlm,
          { contextCommand: commandName, vargs: subVargs });

      const activeCommand = ret[commandName] = {
        ...poolCommand,
        vlm: subVargs.vlm,
        disabled: (module.disabled
            && ((typeof module.disabled !== "function")
                    ? `exports.disabled == ${String(module.disabled)}`
                : (module.disabled(subVargs)
                    && `exports.disabled => ${String(module.disabled(subVargs))}`))),
      };

      if (!module.builder || !module.builder(subVargs)) {
        if (!activeCommand.disabled) activeCommand.disabled = "exports.builder => falsy";
      }
      const exportedCommandName = module.command.match(/^([^ ]*)/)[1];
      if (exportedCommandName !== commandName) {
        this.warn(`Command name mismatch between exported command name '${
            this.theme.command(exportedCommandName)}' and command name '${
            this.theme.command(commandName)}' inferred from file:`, file.name);
      }

      subVargs.usage(module.command.replace(exportedCommandName, "$0"), module.describe);
      if (!activeCommand.disabled || this.vargv.matchAll) {
        globalVargs.command(module.command, module.describe,
            ...(!activeCommand.disabled && module.builder ? [module.builder] : []), () => {});
      } else {
        pool.stats.disabled = (pool.stats.disabled || 0) + 1;
      }
    });
  }
  return ret;
}

/**
 * Load all npm config variables to process.env as if running valma via 'npx -c'
 * FIXME(iridian): horribly broken.
 */
async function __loadNPMConfigVariables () {
  /*
  Broken: current implementation is a silly attempt - only npm config list -l --json options are
  loaded, omitting all npm_lifetime, npm_package_ config etc. options.
  A better overall solution to handling operations which need npm config might be to have valma
  commands explicitly specify that they need those commands but otherwise not load npm at all.
  A reliable method of achieving this is to call such commands with 'npx -c' (but it's still fing
  slow as it spawns node, npm and whatnot.
  Upside of current solution is that running "npm config list" is very fast, and can be optimized
  further too: npm can be programmatically invoked.
  */
  if (_vlm.vargv.packageConfigEnv) {
    _vlm.error("did not load npm_package_* variables (not implemented yet)");
  }
  Object.assign(process.env, {
    npm_execpath: "/usr/lib/node_modules/npm/bin/npm-cli.js",
    npm_lifecycle_event: "env",
    npm_lifecycle_script: "env",
    npm_node_execpath: "/usr/bin/node",
  });
  const execFile = util.promisify(childProcess.execFile);
  const { stdout, stderr } = await execFile("npm", ["config", "list", "-l", "--json"]);
  if (stderr) {
    _vlm.error("leaving: can't load npm config with 'npm config list -l --json'");
    process.exit(-1);
  }
  const npmConfig = JSON.parse(stdout);
  for (const npmVariable of Object.keys(npmConfig)) {
    const value = npmConfig[npmVariable];
    process.env[`npm_config_${npmVariable.replace(/-/g, "_")}`] =
        typeof value === "string" ? value : "";
  }
}

function listMatchingCommands (commandSelector, matchAll = false) {
  const minimatcher = __underToSlash(__globFromExactSelector(commandSelector || "*"));
  const ret = [].concat(...this._activePools.map(pool => pool.listing
      .map(file => __underToSlash(file.name))
      .filter(name => minimatch(name, minimatcher, { dot: matchAll }))
      .map(name => __valmaCommandFromPath(name))
  )).filter((v, i, a) => (a.indexOf(v) === i));
  this.ifVerbose(1)
      .expound(matchAll ? "listMatchingCommands:" : "listAllMatchingCommands:",
          this.theme.command(commandSelector),
          ...(this.verbosity > 1 ? [", minimatcher:", minimatcher] : []),
          "\n\tresults:", ret);
  return ret;
}

function listAllMatchingCommands (commandSelector) {
  return listMatchingCommands.call(this, commandSelector, true);
}

/**
 * Execute given executable as per child_process.spawn.
 * Extra spawnOptions:
 *   noDryRun: if true this call will be executed even if --dry-run is requested.
 *   dryRunReturn: during dry runs this call will return immediately with the value of this option.
 *
 * All argv must be strings, all non-strings and falsy values will be filtered out.
 *
 * @param {*} executable
 * @param {*} [argv=[]]
 * @param {*} [spawnOptions={}]
 * @returns
 */
async function execute (args, spawnOptions = {}) {
  this._flushPendingConfigWrites();
  const argv = __processArgs(args);
  if ((argv[0] === "vlm") && !Object.keys(spawnOptions).length) {
    argv.shift();
    const vargv = this._parseUntilLastPositional(argv, module.exports.command);
    return await this.invoke(vargv.command, vargv._,
        { processArgs: false, flushConfigWrites: true });
  }
  return new Promise((resolve, failure) => {
    this.echo(`${this.getContextIndexText()}>>$`, `${this.theme.executable(...argv)}`);
    const _onDone = (code, signal) => {
      if (code || signal) {
        this.echo(`${this.getContextIndexText()}<<$`, `${this.theme.executable(argv[0])}:`,
        this.theme.error("<error>:", code || signal));
        failure(code || signal);
      } else {
        this._refreshActivePools();
        this._reloadPackageAndToolsetsConfigs();
        this.echo(`${this.getContextIndexText()}<<$`, `${this.theme.executable(argv[0])}:`,
            this.theme.warning("execute return values not implemented yet"));
        resolve();
      }
    };
    if (this.vargv && this.vargv.dryRun && !spawnOptions.noDryRun) {
      this.echo("      dry-run: skipping execution and returning:",
      this.theme.blue(spawnOptions.dryRunReturn || 0));
      _onDone(spawnOptions.dryRunReturn || 0);
    } else {
      const subProcess = childProcess.spawn(
          argv[0],
          argv.slice(1), {
            stdio: ["inherit", "inherit", "inherit"],
            ...spawnOptions,
            detached: true,
          },
      );
      subProcess.on("exit", _onDone);
      subProcess.on("error", _onDone);
      process.on("SIGINT", () => {
        this.warn("vlm killing:", this.theme.green(...argv));
        process.kill(-subProcess.pid, "SIGTERM");
        process.kill(-subProcess.pid, "SIGKILL");
      });
      process.on("SIGTERM", () => {
        this.warn("vlm killing:", this.theme.green(...argv));
        process.kill(-subProcess.pid, "SIGTERM");
        process.kill(-subProcess.pid, "SIGKILL");
      });
    }
  });
}

// All nulls and undefines are filtered out.
// Strings within zeroth and first nested levels are split by whitespace as separate arguments.
// Second nested level of arrays is stringification + direct catenation of entries with .join("").
// The contents of second and more levels of arrays are concatenated together as a single string.
// Booleans are filtered if not associated with a key, in which case they become a valueless --<key>
// or --no-<key> depending on the truthiness.
// Objects are expanded with as a sequence of "--<key>=<value>", where 'value' is passed through
// __processArgs recursively. Nest values containing whitespace twice or they will be split.
// Array values are expanded as sequence of "--<key>=<value1> --<key>=<value2> ...".
// type like so: ["y", { foo: "bar", val: true, nothing: null, neg: false, bar: ["xy", false, 0] }]
//            -> ["y", "--foo", "bar", "--val", "--no-neg", "--bar=xy", "--no-bar", "--bar=0"]
function __processArgs (args) {
  return [].concat(...[].concat(args).map(entry =>
    ((typeof entry === "string")
        ? entry.split(" ")
    : Array.isArray(entry)
        ? entry.map(e => ((typeof e === "string") ? e : JSON.stringify(e))).join("")
    : (!entry || (typeof entry !== "object"))
        ? _toArgString(entry)
        : [].concat(...Object.keys(entry).map(
            key => _toArgString(entry[key], key))))));

  function _toArgString (value, key) {
    if ((value === undefined) || (value === null)) return [];
    if (typeof value === "string") return !key ? value : [`--${key}=${value}`];
    if (typeof value === "boolean") return !key ? [] : value ? `--${key}` : `--no-${key}`;
    if (Array.isArray(value)) return [].concat(...value.map(entry => _toArgString(entry, key)));
    return JSON.stringify(value);
  }
}

function _determineIntrospection (module, selector, isWildcard, invokeEntry) {
  const ret = { module, show: {} };
  Object.keys(this.vargv).forEach(key => {
    if (this.vargv[key] && (key.slice(0, 5) === "show-")) ret.show[key.slice(5)] = this.vargv[key];
  });
  if ((_vlm.vargv.help || this.vargv.help) && (!selector || !invokeEntry)) {
    return { module, builtinHelp: true };
  }
  ret.entryIntro = Object.keys(ret.show).length;

  if (selector && !ret.entryIntro) return undefined;
  if (!selector && ret.entryIntro && !this.vargv.dryRun && !this.vargv.matchAll) {
    // Introspect context
    ret.identityPool = { path: path.dirname(process.argv[1]), commands: {} };
    ret.identityPool.commands.vlm = {
      name: "vlm", module, filePath: __filename, pool: ret.identityPool,
    };
  }
  if (!selector && !ret.entryIntro) { // show default listing
    if (!this.vargv.dryRun) ret.defaultUsage = true;
    ret.show.usage = true;
    ret.show.description = true;
  }
  ret.displayHeaders = isWildcard && !ret.identityPool;
  if (!ret.show.name && !ret.show.usage) {
    if (!isWildcard && this.vargv.dryRun) ret.show.usage = true;
    else if (!ret.entryIntro) ret.show.name = true;
  }
  return ret;
}

function _renderBuiltinHelp (introspect) {
  this.vargs.vlm = this;
  this.vargs.$0 = this.theme.command(introspect.module.command.match(/^[^ ]*/)[0]);
  this.vargs.showHelp("log");
  return [];
}

function _introspectCommands (introspect, commands_, commandGlob, isWildcard_, matchAll) {
  if (introspect.identityPool) {
    const poolIntro = this._introspectPool(
        introspect, introspect.identityPool, introspect.identityPool.commands, matchAll);
    if ((poolIntro["..."] || {}).columns.length === 1) poolIntro["..."].hideHeaders = true;
    return poolIntro;
  }
  const chapters = { "...": { chapters: true } };
  const pools = { "...": { chapters: true, heading: { style: "bold" } } };
  markdownify.addLayoutOrderedProperty(chapters, "pools", pools);

  if (introspect.defaultUsage) {
    chapters.pools["..."].heading.text = `${matchAll ? "All known" : "Visible"} commands by pool:`;
    if (!matchAll) {
      chapters["..."].entries.unshift({
        usage: { heading: { text: `Usage: ${introspect.module.command}`, style: "bold" } }
      });
      chapters.usage = "";
    }
  }
  for (const pool of [...this._activePools].reverse()) {
    const poolIntro = this._introspectPool(introspect, pool, commands_, matchAll,
        isWildcard_, _vlm.vargv.pools);
    markdownify.addLayoutOrderedProperty(pools, pool.name, poolIntro);
    const isEmpty = !Object.keys(poolIntro).filter(k => (k !== "...")).length;
    if (isWildcard_ && (!isEmpty || _vlm.vargv.pools || matchAll)) {
      poolIntro["..."].heading = {
        style: "bold",
        text: `${this.path.join(pool.name, commandGlob)} ${
            isEmpty ? "has no shown commands" : "commands:"} (${
              this.theme.info(Object.keys(pool.stats || {}).map(
                    s => `${s}: ${pool.stats[s]}`).join(", "))
            })`
      };
    } else if (isEmpty) {
      poolIntro["..."].hide = true;
    }
  }
  if (isWildcard_) return chapters;
  const visiblePoolName = Object.keys(pools).find(
      key => (key !== "...") && !(pools[key]["..."] || {}).hide);
  if (!visiblePoolName) return undefined;
  const command = pools[visiblePoolName];
  const keys = Object.keys(command).filter(k => (k !== "..."));
  if (keys.length !== 1) return command;
  const ret = command[keys[0]];
  if (typeof ret !== "object" || !ret || Array.isArray(ret)) return ret;
  ret["..."] = Object.assign(ret["..."] || {}, { entries: (command["..."] || {}).columns });
  return ret;
}

function _introspectPool (introspect, pool, introedCommands, matchAll, isWildcard, showOverridden) {
  const missingFile = "<file_missing>";
  const missingPackage = "<package_missing>";
  const poolIntro = { "...": {
    stats: pool.stats,
    columns: [
      { name: { text: "command", style: "command" } },
      { usage: { style: "command" } },
      { description: { style: { default: missingPackage } } },
      { package: { style: "package" } },
      { version: { style: [{ default: missingPackage }, "version"] } },
      { pool: { text: "source pool" } },
      { file: { text: "script path", style: "path" } },
      { resolved: { text: "real file path", style: [{ default: missingFile }, "path"] } },
      { introduction: {
        oob: true, elementStyle: isWildcard && { prefix: "\n", suffix: "\n" }
      } },
      { source: { oob: true, elementStyle: "cardinal" } },
    ].filter(c => introspect.show[Object.keys(c)[0]]),
  } };
  const trivialKey = Object.keys(introspect.show).length === 1 && Object.keys(introspect.show)[0];
  if (trivialKey) poolIntro["..."].columns = [["", poolIntro["..."].columns[0][trivialKey]]];
  Object.keys(pool.commands)
  .sort()
  .forEach(name => {
    const poolCommand = pool.commands[name];
    if (!poolCommand || !introedCommands[name]
        || (poolCommand.disabled && isWildcard && !matchAll)) return;
    const info = __commandInfo(poolCommand.filePath, pool.path);
    const module = poolCommand.module
        || (poolCommand.module = info.resolvedPath && require(info.resolvedPath));
    const rowData = { disabled: !!poolCommand.disabled };
    if (!module || !module.command) rowData.missing = true;
    if (poolCommand.disabled) rowData.disabled = true;
    if ((introedCommands[name] || { pool }).pool !== pool) {
      if (!showOverridden) return;
      rowData.overridden = true;
      rowData.entries = { name: { style: "overridden", }, usage: { style: "overridden " } };
    }
    const _addData = (property, data) => introspect.show[property] && (rowData[property] = data);
    _addData("name", poolCommand.disabled ? `(${name})` : name);
    _addData("usage", (module && module.command) || `${name} ${missingPackage}`);
    _addData("description", (module && module.describe) || missingPackage);
    _addData("package", info.package);
    _addData("version", info.version || missingPackage);
    _addData("pool", info.poolPath);
    _addData("file", info.filePath);
    _addData("resolved", info.resolvedPath || missingFile);
    if (introspect.show.introduction) {
      rowData.introduction = !module ? null : (module.introduction || module.describe);
      if (rowData.introduction === null) {
        this.warn(`Cannot read command '${name}' script introduction from:`,
            info.resolvedPath);
      }
    }
    if (introspect.show.source) {
      rowData.source = !module ? null : String(shell.head({ "-n": 1000000 }, info.resolvedPath));
      if (rowData.source === null) {
        this.warn(`Cannot read command '${name}' script source from:`, info.resolvedPath);
      }
    }
    poolIntro[name] = trivialKey ? rowData[trivialKey] : rowData;
  });
  return poolIntro;
}

function __commandInfo (filePath, poolPath) {
  const ret = { filePath, poolPath };
  if (!filePath || !shell.test("-e", filePath)) return ret;
  ret.resolvedPath = fs.realpathSync(filePath);
  let remaining = path.dirname(ret.resolvedPath);
  while (remaining !== "/") {
    const packagePath = _vlm.path.join(remaining, "package.json");
    if (shell.test("-f", packagePath)) {
      const packageJson = JSON.parse(shell.head({ "-n": 1000000 }, packagePath));
      return { ...ret, version: packageJson.version, package: packageJson.name };
    }
    remaining = _vlm.path.join(remaining, "..");
  }
  return ret;
}

async function _fillVargvInteractively () {
  const interactiveOptions = this.vargs.getOptions().interactive;
  if (!this.interactive || !interactiveOptions) {
    // TODO(iridian): Add assertions if some required vargs are not set.
    return this.vargv;
  }
  delete this.vargs.getOptions().interactive;
  const questions = [];
  for (const optionName of Object.keys(interactiveOptions)) {
    const option = interactiveOptions[optionName];
    const question = Object.assign({}, option.interactive);
    if (question.when !== "always") {
      if ((question.when !== "if-undefined") || (typeof this.vargv[optionName] !== "undefined")) {
        continue;
      }
    }
    delete question.when;
    if (!question.name) question.name = optionName;
    if (!question.message) question.message = option.description;
    if (!question.choices && option.choices) question.choices = [...option.choices];
    if (option.default !== undefined) {
      if (!["list", "checkbox"].includes(question.type)) {
        question.default = option.default;
      } else {
        const oldChoices = [];
        (Array.isArray(option.default) ? option.default : [option.default]).forEach(default_ => {
          if (!question.choices || !question.choices.includes(default_)) oldChoices.push(default_);
        });
        question.choices = oldChoices.concat(question.choices || []);
        if (question.type === "list") {
          question.default = question.choices.indexOf(option.default);
        } else if (question.type === "checkbox") {
          question.default = option.default;
        }
      }
    }
    // if (!question.validate) ...;
    // if (!question.transformer) ...;
    // if (!question.pageSize) ...;
    // if (!question.prefix) ...;
    // if (!question.suffix) ...;
    questions.push(question);
  }
  if (!Object.keys(questions).length) return this.vargv;
  const answers = {};
  for (const question of questions) {
    do {
      Object.assign(answers, await this.inquire([question]));
    } while (question.confirm && !await question.confirm(answers[question.name], answers));
  }
  // FIXME(iridian): handle de-hyphenations, camelcases etc. all other option variants.
  // Now only updating the verbatim option.
  return Object.assign(this.vargv, answers);
}


function _reloadPackageAndToolsetsConfigs () {
  // TODO(iridian): Implement locally pending config writes. See _flushPendingConfigWrites
  if (shell.test("-f", packageConfigStatus.path)) {
    try {
      _vlm.packageConfig = JSON.parse(shell.head({ "-n": 1000000 }, packageConfigStatus.path));
      __deepFreeze(_vlm.packageConfig);
    } catch (error) {
      this.exception(String(error), `while reading ${packageConfigStatus.path}`);
      throw error;
    }
  }
  if (shell.test("-f", toolsetsConfigStatus.path)) {
    try {
      _vlm.toolsetsConfig = JSON.parse(shell.head({ "-n": 1000000 }, toolsetsConfigStatus.path));
      __deepFreeze(_vlm.toolsetsConfig);
    } catch (error) {
      _vlm.exception(String(error), `while reading ${packageConfigStatus.path}`);
      throw error;
    }
  }
}

function getPackageConfig (...keys) { return this._getConfigAtPath(this.packageConfig, keys); }
function getToolsetsConfig (...keys) { return this._getConfigAtPath(this.toolsetsConfig, keys); }
function getValmaConfig (...keys) { return this._getConfigAtPath(this.toolsetsConfig, keys); }

function _getConfigAtPath (root, keys) {
  return [].concat(...keys)
      .filter(key => (key !== undefined))
      .reduce((result, key) => ((result && (typeof result === "object")) ? result[key] : undefined),
          root);
}

function updatePackageConfig (updates) {
  // TODO(iridian): Implement locally pending config writes. See _flushPendingConfigWrites
  if (typeof updates !== "object" || !updates) {
    throw new Error(`Invalid arguments for updatePackageConfig, expexted object, got ${
        typeof update}`);
  }
  if (!_vlm.packageConfig) {
    throw new Error("vlm.updatePackageConfig: cannot update package.json as it doesn't exist");
  }
  const updatedConfig = __deepAssign(_vlm.packageConfig, updates);
  if (updatedConfig !== _vlm.packageConfig) {
    packageConfigStatus.updated = true;
    _vlm.packageConfig = updatedConfig;
    _vlm.ifVerbose(1)
        .info("package.json updated:", updates);
  }
}

function updateToolsetsConfig (updates) {
  // TODO(iridian): Implement locally pending config writes. See _flushPendingConfigWrites
  if (typeof updates !== "object" || !updates) {
    throw new Error(`Invalid arguments for updateToolsetsConfig, expexted object, got ${
        typeof update}`);
  }
  if (!_vlm.toolsetsConfig) {
    _vlm.toolsetsConfig = {};
    toolsetsConfigStatus.updated = true;
  }
  const updatedConfig = __deepAssign(_vlm.toolsetsConfig, updates);
  if (updatedConfig !== _vlm.toolsetsConfig) {
    toolsetsConfigStatus.updated = true;
    _vlm.toolsetsConfig = updatedConfig;
    _vlm.ifVerbose(1)
        .info("toolsets.json updated:", updates);
  }
}

// Toolset vlm functions

function getToolsetConfig (toolsetName, ...rest) {
  if (typeof toolsetName !== "string" || !toolsetName) {
    throw new Error(`Invalid arguments for getToolsetConfig, expexted string|..., got ${
        typeof toolsetName}`);
  }
  return this.getToolsetsConfig(toolsetName, ...rest);
}

function getToolConfig (toolsetName, toolName, ...rest) {
  if (typeof toolsetName !== "string" || typeof toolName !== "string"
      || !toolsetName || !toolName) {
    throw new Error(`Invalid arguments for getToolConfig, expexted string|string|..., got ${
        typeof toolsetName}|${typeof toolName}`);
  }
  return this.getToolsetsConfig(toolsetName, "tools", toolName, ...rest);
}

function confirmToolsetExists (toolsetName) {
  if (this.getToolsetConfig(toolsetName)) return true;
  this.warn(`Cannot find toolset '${toolsetName}' from configured toolsets:`,
      Object.keys(this.getToolsetsConfig() || {}).join(", "));
  return false;
}

function updateToolsetConfig (toolsetName, updates) {
  if (typeof toolsetName !== "string" || typeof updates !== "object" || !toolsetName || !updates) {
    throw new Error(`Invalid arguments for updateToolsetConfig, expexted string|object, got ${
        typeof toolsetName}|${typeof updates}`);
  }
  return this.updateToolsetsConfig({ [toolsetName]: updates });
}

function updateToolConfig (toolsetName, toolName, updates) {
  if (typeof toolsetName !== "string" || typeof toolName !== "string" || typeof updates !== "object"
      || !toolsetName || !toolName || !updates) {
    throw new Error(`Invalid arguments for updateToolConfig, expexted string|string|object, got ${
        typeof toolsetName}|${typeof toolName}|${typeof updates}`);
  }
  return this.updateToolsetsConfig({ [toolsetName]: { tools: { [toolName]: updates } } });
}

function createStandardToolsetOption (description) {
  return {
    type: "string", default: this.toolset,
    description,
    interactive: {
      type: "input", when: "if-undefined",
      confirm: value => this.confirmToolsetExists(value),
    },
  };
}


function __deepFreeze (object) {
  if (typeof object !== "object" || !object) return;
  Object.freeze(object);
  Object.values(object).forEach(__deepFreeze);
}

function __deepAssign (target, source) {
  if (typeof source === "undefined") return target;
  if (Array.isArray(target)) return target.concat(source);
  if ((typeof source !== "object") || (source === null)
      || (typeof target !== "object") || (target === null)) return source;
  let objectTarget = target;
  Object.keys(source).forEach(sourceKey => {
    const newValue = __deepAssign(target[sourceKey], source[sourceKey]);
    if (newValue !== objectTarget[sourceKey]) {
      if (objectTarget === target) objectTarget = { ...target };
      objectTarget[sourceKey] = newValue;
    }
  });
  return objectTarget;
}

function _flushPendingConfigWrites () {
  // TODO(iridian): Implement locally pending config writes.
  // Right now pending config writes are globally stored in _vlm. This kind of works
  // but the resulting semantics are not clean and might result in inconsistent/partial config
  // writes. The config files could be stored in the local vlm contexts and selectively written only
  // when the command associated with a context successfully completes.
  this._commitUpdates("toolsets.json", toolsetsConfigStatus, () => _vlm.toolsetsConfig);
  this._commitUpdates("package.json", packageConfigStatus, () => {
    const reorderedConfig = {};
    reorderedConfig.name = _vlm.packageConfig.name;
    reorderedConfig.version = _vlm.packageConfig.version;
    if (_vlm.packageConfig.valaa !== undefined) reorderedConfig.valaa = _vlm.packageConfig.valaa;
    Object.keys(_vlm.packageConfig).forEach(key => {
      if (reorderedConfig[key] === undefined) reorderedConfig[key] = _vlm.packageConfig[key];
    });
    return reorderedConfig;
  });
}

function _commitUpdates (filename, configStatus, createUpdatedConfig) {
  // TODO(iridian): Implement locally pending config writes. See _flushPendingConfigWrites
  if (!configStatus.updated) return;
  if (_vlm.vargv && _vlm.vargv.dryRun) {
    this.info(`commit '${filename}' updates --dry-run:`, "not committing queued updates to file");
    return;
  }
  const configString = JSON.stringify(createUpdatedConfig(), null, 2);
  shell.ShellString(`${configString}\n`).to(configStatus.path);
  this.ifVerbose(1)
      .info(`committed '${filename}' updates to file:`);
  configStatus.updated = false;
}

function __createVargs (args, cwd = process.cwd()) {
  // Get a proper, clean yargs instance for neat extending.
  const ret = yargs(args, cwd, require);

  // Extend option/options with:
  //   interactive
  //   causes
  const baseOptions = ret.options;
  ret.option = ret.options = function valmaOptions (opt, attributes_) {
    if (typeof opt === "object") { // Let yargs expand the options object
      baseOptions.call(this, opt, attributes_);
      return this;
    }
    const attributes = { ...attributes_ };
    const optionState = this.getOptions();
    if (attributes.interactive) {
      if (!optionState.interactive) optionState.interactive = {};
      optionState.interactive[opt] = attributes;
    }
    if (attributes.causes) {
      if (!optionState.causes) optionState.causes = {};
      optionState.causes[opt] = attributes.causes;
    }
    const subVLM = this.vlm;
    if (subVLM && subVLM.toolset) {
      const subPath = ["commands", subVLM.contextCommand, "options", opt];
      let default_ = subVLM.tool && subVLM.getToolConfig(subVLM.toolset, subVLM.tool, ...subPath);
      if (default_ === undefined) default_ = subVLM.getToolsetConfig(subVLM.toolset, ...subPath);
      if (default_ !== undefined) attributes.default = default_;
    }
    if (attributes.default && attributes.choices) {
      attributes.choices =
          (Array.isArray(attributes.default) ? attributes.default : [attributes.default])
            .filter(defaultValue => !attributes.choices.includes(defaultValue))
            .concat(attributes.choices);
    }
    baseOptions.call(this, opt, attributes);
    return this;
  };

  // Extend parse with:
  //   causes
  const baseParse = ret.parse;
  ret.parse = function valmaParse (...rest) {
    const vargv = baseParse.apply(this, rest);
    const options = this.getOptions();
    let effects = [];
    for (const cause of Object.keys(options.causes || {})) {
      effects = effects.concat(_consequences(vargv[cause], options.causes[cause]));
    }
    function _consequences (reason, causes) {
      if (!reason) return [];
      if (typeof causes === "string") return [`--${causes}`];
      if (Array.isArray(causes)) {
        return [].concat(...causes.map(cause => _consequences(reason, cause)));
      }
      return [];
    }
    if (effects.length) {
      const { argv } = yargsParser(effects, { ...options });
      for (const effect of Object.keys(argv)) {
        const defaultValue = options.default[effect];
        if (effect !== "_" && (argv[effect] !== vargv[effect]) && (argv[effect] !== defaultValue)
            && (argv[effect] || (defaultValue !== undefined))) {
          if (defaultValue && (vargv[effect] !== defaultValue)) {
            throw new Error(`Conflicting effect '${effect}' has its default value '${defaultValue
                }' explicitly set to '${vargv[effect]}' and caused to '${argv[effect]}'`);
          }
          vargv[effect] = argv[effect];
        }
      }
    }
    return vargv;
  };
  return ret;
}
