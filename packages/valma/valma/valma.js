#!/usr/bin/env node

const childProcess = require("child_process");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");
const util = require("util");
const cardinal = require("cardinal");
const colors = require("colors/safe");

let inquirer; // = require("inquirer"); // inquirer is fat. Postpone load to vlm.inquire ()
const minimatch = require("minimatch");
const semver = require("semver");
const shell = require("shelljs");
const yargs = require("yargs/yargs");
const yargsParser = require("yargs-parser").detailed;

const patchWith = require("@valos/tools/patchWith").default;
const fetchJSON = require("@valos/tools/fetchJSON").default;
const dumpify = require("@valos/tools/dumpify").default;
const wrapErrorModule = require("@valos/tools/wrapError");
const {
  thenChainEagerly, thisChainEagerly, thisChainRedirect, thisChainReturn,
} = require("@valos/tools/thenChainEagerly");

cardinal.tomorrowNight = require("cardinal/themes/tomorrow-night");

const markdownify = require("../markdownify");

const wrapError = wrapErrorModule.wrapError;
const outputError = wrapErrorModule.outputError;
const dumpObject = wrapErrorModule.dumpObject;

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
  "pool-base": path.posix.resolve("."),
  "pool-subfolders": ["valma.bin/", "node_modules/.bin/"],
  "global-pool": process.env.VLM_GLOBAL_POOL || (shell.which("vlm") || "").slice(0, -3),
};

const _filenamePrefix = "_vlm";

// vlm - the Valma global API root context (with vlm.taskDepth === 0).
// Nested command invokations and delegations will create local vlm
// contexts with increased vlm.taskDepth and which inherit from their
// parent contexts as per Object.create(parentVLM). These vlm contexts
// are available to their command script modules via exports.builder
// *yargs.vlm* parameter and also via exports.handler *yargv.vlm*
// parameter.
const _vlm = {
  // Executes a command as an interactive foreground task and returns
  // a promise to its result value. If the command results in an error
  // it will be delivered through the promise reject. Any plain object
  // args will have their key-value pairs expanded to boolean or
  // parameterized flags depending on the value type, using the key as
  // the flag name.
  //
  // Only one foreground task can execute at one time at a given
  // vlm.taskDepth. Subsequent foreground task executions at
  // a particular taskDepth will wait until all previously executed
  // tasks are complete before starting themselves.
  // All vlm.inquire calls are considered foreground tasks.
  // FIXME(iridian): Actually implement the above semantics. Now
  // there's no sequencing.
  //
  // A coding principle of awaiting on the result of all execute calls
  // will result in a strictly linear execution of all foreground task
  // computation, side-effects and inputs. Conversely not awaiting for
  // a child task to finish allows the parent task to continue
  // computation, display diagnostics and delegate new background tasks.
  //
  // Nevertheless the overall control flow happens in a linear fashion
  // as new foreground tasks will wait for previous ones to finish.
  execute,

  // Special case of execute of the form 'vlm <command> ...'.
  invoke,

  // Special case of execute which has the executed script interact
  // directly with the current TTY and returns the provided return
  // value instead of stdout if successful.
  interact,

  // Initiates the given command as a primarily non-interactive
  // background task which returns the command output in a promise or
  // rejects it in case of an error.
  //
  // Interactive questions which are requested via vlm.inquire will
  // throw, unless the question has the 'audience' option set to true.
  // In this case the user is prompted for an audience at the next
  // suitable time.
  //
  // All diagnostics and standard error output is buffered and
  // displayed only before the task completes or immediately before
  // user accepts a valma audience.
  //
  // For native commands the standard output is buffered and returned
  // as a string (or as a JSON.parse'd object if options.json is
  // truthy) and failures are delivered as Error objects via
  // the promise reject.
  delegate,

  taskDepth: 0,

  cwd: process.cwd(),

  getPackageConfig,
  getValOSConfig,
  getFileConfig,
  getToolsetsConfig,
  getToolsetPackageConfig,
  findToolsetsConfig,

  // Registers pending updates to the package.json config file (and
  // immediately updates vlm._packageConfigStatus.content) which are
  // written to file only immediately before valma execution exits or
  // an external command is about to be executed.
  // TODO(iridian): Improve the flush semantics, maybe to
  // flush-on-subcommand-success - now it's just silly.
  updatePackageConfig,

  // Registers pending updates to the toolsets.json config file (and
  // immediately updates vlm._toolsetsConfigStatus.content) which are
  // written to file only immediately before valma execution exits or
  // an external command is about to be executed.
  // TODO(iridian): Improve the flush semantics, maybe to
  // flush-on-subcommand-success - now it's just silly.
  updateToolsetsConfig,

  updateFileConfig,

  // TODO(iridian): These should eventually be in a separate library. Fundamentally valma shouldn't
  // know about toolsets. OTOH valma type and the toolset scripts are part of valma package, so...
  getToolsetConfig,
  getToolConfig,

  findToolsetConfig,
  findToolConfig,
  confirmToolsetExists,
  updateToolsetConfig,
  updateToolConfig,
  domainVersionTag,

  defaultTags: {},
  addNewDevDependencies,

  // Returns a list of available sub-command names which match the given command glob.
  listMatchingCommands,
  listAllMatchingCommands,

  isGlob,
  filenameFromCommand,
  commandFromFilename,

  // Enables usage of ANSI colors using the safe variant of Marak's colors
  // See https://github.com/Marak/colors.js
  colors,

  // The currently active theme.
  theme: colors,

  // Opens interactive inquirer prompt and returns a completion promise.
  // See https://github.com/SBoudrias/Inquirer.js/
  inquire (...rest) {
    // inquirer loads slowly. Lazy load here.
    if (!inquirer) inquirer = require("inquirer");

    _vlm.inquire = inquirer.createPromptModule();
    return this.inquire(...rest);
  },

  // shelljs namespace of portable Unix commands
  // See https://github.com/shelljs/shelljs
  shell,

  // semver namespace of the npm semver parsing tools
  // See https://github.com/npm/node-semver
  semver,

  // minimatch namespace of the glob matching tools
  // See https://github.com/isaacs/minimatch
  minimatch,

  fetch,
  fetchJSON (input, options) { return fetchJSON(input, options, fetch); },

  // node.js path.posix tools - all shell commands expect posix-style paths.
  // See https://nodejs.org/api/path.html
  path: path.posix,

  // forward to node require. Resolve non-absolute paths based on cwd.
  require: (() => {
    const ret = function vlmRequire (path_) {
      const targetPath = require.resolve(path_, { paths: [this.cwd] });
      if (!targetPath) {
        throw new Error(`Could not require.resolve path "${path_}" from cwd "${this.cwd}"`);
      }
      return require(targetPath);
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

  _readFile: util.promisify(fs.readFile),
  readFile: function readFile (filename, encoding = "utf8", ...rest) {
    return this._readFile(filename, encoding, ...rest);
  },

  async tryReadFile (filename, encoding = "utf8", ...rest) {
    try {
      return await this._readFile(filename, encoding, ...rest);
    } catch (error) {
      return undefined;
    }
  },

  writeFile (fileName, textOrBuffer, encoding = "utf8") {
    return new Promise((resolve, reject) => {
      let fd;
      fs.open(fileName, "w", (openError, fd_) => {
        fd = fd_;
        if (openError) {
          reject(new Error(`Error while opening '${fileName}' for writing: ${openError}`));
        } else if (typeof textOrBuffer === "string") {
          fs.write(fd, textOrBuffer, 0, encoding, onWriteDone);
        } else {
          const buffer = (textOrBuffer instanceof ArrayBuffer) ? Buffer.from(textOrBuffer)
              : (textOrBuffer instanceof Uint8Array) ? textOrBuffer
              : undefined;
          if (buffer === undefined) {
            throw new Error(
                `Unrecognized textOrBuffer: not a string, an ArrayBuffer or a Uint8Array, got: ${
                  (textOrBuffer != null && (textOrBuffer.constructor || {}).name)
                      || typeof textOrBuffer}`);
          }
          fs.write(fd, buffer, 0, buffer.length, 0, onWriteDone);
        }
        function onWriteDone (writeError /* , bytesWritten, buffer */) {
          try {
            if (!writeError) {
              resolve();
            } else {
              reject(new Error(`Error while writing to '${fileName}': ${writeError}`));
            }
          } finally {
            if (fd) fs.close(fd, () => {});
          }
        }
      });
    });
  },

  async inquireQuestion (question) {
    return (await this.inquire({
      ...question,
      name: "question",
    })).question;
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
    return renderer && rest.map(value => renderer(value, this));
  },

  getVerbosity () { return this.verbosity; },

  ifVerbose (minimumVerbosity, callback) {
    function hush () { return this; }
    if (this.verbosity < minimumVerbosity) {
      return {
        ifVerbose: hush, log: hush, echo: hush, warn: hush, error: hush, exception: hush,
        info: hush, babble: hush, expound: hush, clock: hush,
      };
    }
    if (callback) callback.call(this);
    return this;
  },

  // Alias for console.log for unprocessed payload output directly to stdout
  debug (...rest) {
    console.debug(...rest);
    return this;
  },
  log (...rest) {
    console.log(...rest);
    return this;
  },
  chapter (name, body) {
    return {
      "...": { chapters: true, ...(name && { heading: name }) },
      ...body,
    };
  },
  table (headers, rows) {
    const columns = [];
    let ellipsisIndex;
    const columnTemplates = {};
    for (const header of headers) {
      if (header === "...") ellipsisIndex = columns.length;
      columns.push([header, columnTemplates[header] = {}]);
    }
    if (ellipsisIndex !== undefined) {
      const ellipsisColumns = [];
      for (const entry of rows) {
        for (const prop of Object.keys(entry)) {
          if (!columnTemplates[prop]) {
            ellipsisColumns.push([prop, columnTemplates[prop] = {}]);
          }
        }
      }
      columns.splice(ellipsisIndex, 0, ellipsisColumns);
    }
    return { "...": { columns, entries: rows } };
  },
  result (...rest) {
    const outputs = this.render(_vlm.vargv.output, ...rest.map(result =>
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
    if (_shouldOutputMessage(this, "echo", "echos")) {
      console.warn(" ".repeat((this.taskDepth * 2) - 1), this.theme.echo(...rest));
    }
    return this;
  },
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
    if (_shouldOutputMessage(this, "warning", "warnings")) {
      console.warn(this.theme.warning(`${this.getContextName()} warns:`, msg), ...rest);
    }
    return this;
  },
  // When something is definitely wrong and operation cannot do everything that was expected
  // but might still complete.
  // As a diagnostic message outputs to stderr where available.
  error (msg, ...rest) {
    if (_shouldOutputMessage(this, "error", "errors")) {
      console.error(this.theme.error(`${this.getContextName()} laments:`, msg), ...rest);
    }
    return this;
  },
  // When something is catastrophically wrong and operation terminates immediately.
  // As a diagnostic message outputs to stderr where available.
  exception (error, context /* , ...rest */) {
    if (this.theme.exception) {
      let actualError = error || new Error("vlm.exception called without error object");
      if (!(error instanceof Error)) {
        actualError = new Error(String((error && error.message) || error || "error missing"));
        if (error.stack) actualError.stack = error.stack;
      }
      outputError(actualError, `${this.getContextName()} panics: exception from ${context}`, {
        debug: (msg, ...rest_) => console.error(this.theme.babble(msg), ...rest_),
        info: (msg, ...rest_) => console.error(this.theme.info(msg), ...rest_),
        error: (msg, ...rest_) => console.error(this.theme.error(msg), ...rest_),
        warn: (msg, ...rest_) => console.warn(this.theme.warning(msg), ...rest_),
        log: (msg, ...rest_) => console.log(msg, ...rest_),
      }, this.getVerbosity());
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
    if (_shouldOutputMessage(this, "info", "infos")) {
      console.warn(this.theme.info(`${this.getContextName()} informs:`, msg), ...rest);
    }
    return this;
  },
  clock (context, event, ...messages) {
    if (_shouldOutputMessage(this, "clock", "infos")) { // there is no --clocks
      console.warn(this.theme.clock(`${context} clocks:`, event),
          ...messages.map(msg => ((typeof msg === "string") ? msg : dumpify(msg, { indent: 0 }))));
    }
    if (this.clockEvents) {
      let start = process.hrtime(this.clockStartTime);
      start = start[0] * 1000 + Math.floor(start[1] / 1000000);
      const previousEvents = this.clockPreviousEvents || (this.clockPreviousEvents = {});
      const previous = previousEvents[context];
      if (previous && previous.message) previous.duration = start - previous.start;
      this.clockEvents.push((previousEvents[context] =
          { context, event, start, message: messages[0] || "" }));
    }
    return this;
  },
  initializeClock () {
    this.clockEvents = [];
    this.clockStartTime = process.hrtime();
  },
  finalizeClock () {
    if (!this.clockEvents) return;
    let end = process.hrtime(this.clockStartTime);
    end = end[0] * 1000 + Math.floor(end[1] / 1000000);
    Object.values(this.clockPreviousEvents || {}).forEach(pendingEvent => {
      if (pendingEvent.message) pendingEvent.duration = end - pendingEvent.start;
    });
    delete this.clockPreviousEvents;
  },
  instruct (msg, ...rest) {
    if (_shouldOutputMessage(this, "instruct", "instructs")) {
      console.warn(this.theme.instruct(`${this.getContextName()} instructs:`, msg), ...rest);
    }
    return this;
  },

  // Babble and expound are for learning and debugging. They are messages an attuned devop doesn't
  // want to see as they are noisy and don't fit any of the info criterias above.
  // They should always be gated behind --verbose.
  // Babble is for messages which take only couple lines.
  // As diagnostic messages these output to stderr where available.
  babble (msg, ...rest) {
    if (_shouldOutputMessage(this, "babble", "babbles")) {
      console.warn(this.theme.babble(`${this.getContextName()} babbles:`, msg), ...rest);
    }
    return this;
  },

  // Expound messages can be arbitrarily immense.
  // As diagnostic messages these output to stderr where available.
  expound (msg, ...rest) {
    if (_shouldOutputMessage(this, "expound", "expounds")) {
      console.warn(this.theme.expound(`${this.getContextName()} expounds:`, msg), ...rest);
    }
    return this;
  },

  thenChainEagerly,
  thisChainEagerly,
  thisChainRedirect,
  thisChainReturn,

  // Implementation details
  _invoke,
  _parseUntilLastPositional,
  _availablePools: [],
  _activePools: [],
  _selectActiveCommands,
  _determineIntrospection,
  _renderBuiltinHelp,
  _introspectCommands,
  _introspectPool,
  _fillVargvInteractively,
  _getConfigAtPath,
  _flushPendingConfigWrites,
};

globalVargs.vlm = _vlm;
colors._setTheme = _setTheme;
function _setTheme (theme) {
  this.decoratorOf = function decoratorOf (rule) {
    const self = this;
    return function decorate (...texts) {
      return Object.assign(Object.create(self), {
        object: this || null,
      }).decorateWith([rule, "join"], texts);
    };
  };
  this.decorateWith = function decorateWith (rule, texts = []) {
    try {
      if ((rule === undefined) || (rule === null)) return texts;
      if (typeof rule === "string") return this.decorateWith(this[rule], texts);
      if (typeof rule === "function") return rule.apply(this, texts);
      if (Array.isArray(rule)) {
        return rule.reduce(
            (subTexts, subRule) => this.decorateWith(subRule, [].concat(subTexts)), texts);
      }
      return Object.keys(rule).reduce(
          (subTexts, ruleKey) => this.decorateWith(ruleKey, [rule[ruleKey]].concat(subTexts)),
          texts);
    } catch (error) {
      console.log("error while decorating with rule:", rule,
          "\n\ttexts:", dumpify(texts, { indent: 2 }));
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
    defaultValue (defaultValue, ...texts) {
      if (texts.length > 1 || (texts[0] !== undefined)) return texts;
      if (typeof defaultValue !== "object") return [defaultValue];
      return this.decorateWith(defaultValue);
    },
    property (keyPath) {
      const ret = [].concat(keyPath).reduce((v, key) =>
          ((key == null) ? v
          : (v == null) ? null
          : v[key]), this.object);
      return (ret !== undefined) ? [ret] : [];
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
    if: function if_ ([conditionRule, thenRule, elseRule], ...texts) {
      const condition = this.decorateWith(conditionRule, texts);
      return this.decorateWith(condition[0] ? thenRule : elseRule, texts);
    },
    matches (conditions, ...texts) {
      return [].concat(...texts.map(text => {
        for (const matcher of Array.isArray(conditions) ? conditions : Object.entries(conditions)) {
          if (text.match((typeof matcher[0] === "string") ? new RegExp(matcher[0]) : matcher[0])) {
            return this.decorateWith(matcher[1], [text]);
          }
        }
        return [];
      }));
    },
    echo: "dim",
    warning: ["bold", "yellow"],
    error: ["bold", "red"],
    exception: ["newlinesplit", { first: "error", nonfirst: "warning" }],
    info: "cyan",
    clock: ["italic", "cyan"],
    instruct: ["bold", "cyan"],
    babble: "cyan",
    expound: "cyan",

    strong: "bold",
    em: "italic",

    argument: ["bold", "blue"],
    return: ["bold", "italic", "blue"],
    executable: ["flatsplit", { first: ["magenta"], nonfirst: "argument" }],
    command: ["flatsplit", { first: ["bold", "magenta"], nonfirst: "argument" }],
    vlmCommand: ["flatsplit", { first: "executable", nonfirst: "command" }],
    overridden: ["strikethrough", "command"],
    package: ["dim", "bold", "yellow"],
    path: ["underline"],
    link: ["underline", "cyan"],
    version: ["italic"],
    name: ["italic"],
    success: ["bold", "green"],
    failure: ["bold", "red"],
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
  "markdown-cli": (value, logger) => markdownify.default(value, _vlm.theme, undefined, { logger }),
  "markdown-json": (value, logger) => markdownify.extendWithLayouts(value, undefined, { logger }),
  markdown: (value, logger) => markdownify.default(value, themes.codeless, undefined, { logger }),
};

const _devMode = false;

function _shouldOutputMessage (vlm, outputType, typeStateName) {
  return !_vlm.isCompleting && vlm.theme[outputType] && vlm._state[typeStateName];
}

module.exports = {
  command: "vlm [--help] [-<flagchars>] [--<flag>...] [--<option>=<value>..] [commandSelector]",
  describe: "Dispatch a valma command to its command script",
  introduction: { "...": "valma/docs/INTRODUCTION.vdon" },

  builder: (vargs_) => {
    const theme = themes.codeless;
    return vargs_.options({
  //    .usage(module.exports.command, module.exports.describe, iy => iy)
        l: {
          group: "Valma command options:",
          alias: theme.argument("list"), type: "boolean", global: false,
          description: "List all command(s) which infix match the selector",
        },
        p: {
          group: "Valma command options:",
          alias: theme.argument("pools-breakdown"), type: "boolean", global: false,
          description: "Show pool breakdown in listings (including empty pools).",
        },
        a: {
          group: "Valma command options:",
          alias: theme.argument("match-all"), type: "boolean", global: false,
          description: "Match (a)ll hidden and disabled commands in the selection",
          causes: ["enable-disabled", "reveal-hidden"],
        },
        e: {
          group: "Valma command options:",
          alias: theme.argument("enable-disabled"), type: "boolean", global: false,
          description: "Explicitly (e)nable disabled command(s) in the selection",
        },
        r: {
          group: "Valma command options:",
          alias: theme.argument("reveal-hidden"), type: "boolean", global: false,
          description: "Explicitly (r)eveal all dot-prefixed paths in the selection",
        },
        f: {
          group: "Valma command options:",
          type: "boolean", global: false,
          alias: theme.argument("force-broken"),
          description: "Force-call broken commands in wildcard selections instead of skipping",
        },
        interactive: {
          group: "Valma console options:",
          type: "boolean", default: true, global: false,
          description: "Prompt for missing fields. If false then missing required fields will throw"
        },
        s: {
          group: "Valma console options:",
          alias: theme.argument("silence"), type: "boolean", global: false,
          description: "Silence all console output except failures and potential results.",
          causes: [
            "no-echos",
            "no-logs", "no-errors", "no-infos", "no-warnings",
            "no-instructs", "no-babbles", "no-expounds"
          ],
        },
        echos: {
          group: "Valma console options:",
          type: "boolean", global: false, default: true,
          description: "Show echo messages",
        },
        logs: {
          group: "Valma console options:",
          type: "boolean", global: false, default: true,
          description: "Show log messages",
        },
        errors: {
          group: "Valma console options:",
          type: "boolean", global: false, default: true,
          description: "Show error messages",
        },
        infos: {
          group: "Valma console options:",
          type: "boolean", global: false, default: true,
          description: "Show info messages",
        },
        instructs: {
          group: "Valma console options:",
          type: "boolean", global: false, default: true,
          description: "Show instruct messages",
        },
        warnings: {
          group: "Valma console options:",
          type: "boolean", global: false, default: true,
          description: "Show warning messages",
        },
        babbles: {
          group: "Valma console options:",
          type: "boolean", global: false, default: _devMode,
          description: "Show babble messages",
        },
        expounds: {
          group: "Valma console options:",
          type: "boolean", global: false, default: _devMode,
          description: "Show expound messages",
        },
        output: {
          group: "Valma output options:",
          type: "string", global: false, default: "markdown-cli", choices: Object.keys(_renderers),
          description: "Result output format",
        },
        json: {
          group: "Valma output options:",
          type: "boolean", global: false,
          description: "Alias for --output=json for rendering result as JSON into standard output",
          causes: "output=json",
        },
        markdown: {
          group: "Valma output options:",
          type: "boolean", global: false,
          description: "Alias for --output=markdown for rendering result as raw unstyled markdown",
          causes: "output=markdown",
        },
        vlm: {
          group: "Valma environment options:",
          type: "object", global: false,
          description: "Set vlm context object fields (f.ex. --vlm.lineLength=60)",
        },
        clock: {
          group: "Valma environment options:",
          type: "boolean", default: false, global: false,
          description: "Collect and time vlm.clock call information in vlm.clockEvents"
        },
        promote: {
          group: "Valma environment options:",
          type: "boolean", default: true, global: false,
          description: "Promote to 'vlm' in the most specific pool available via forward",
        },
        "npm-config-env": {
          group: "Valma environment options:",
          type: "boolean", default: true, global: false,
          description: "Add npm global environment if they are missing",
        },
        "package-config-env": {
          group: "Valma environment options:",
          type: "boolean", default: false, global: false,
          description: "Add missing npm package environment variables (not implemented)",
        },
        b: {
          group: "Valma environment options:",
          alias: theme.argument("bypass-validations"), type: "boolean", global: false,
          description: "Bypass validations",
        },
        forward: {
          group: "Valma environment options:",
          type: "boolean", default: true, global: false,
          description: "Allow vlm forwarding due to promote, node-env or having to load vlm path",
        },
        "pool-base": {
          group: "Valma environment options:",
          type: "string", default: defaultPaths["pool-base"], global: false,
          description: "Initial pool base path for gathering pools through all parent paths.",
        },
        "pool-subfolders": {
          group: "Valma environment options:", array: true,
          type: "string", default: defaultPaths["pool-subfolders"], global: false,
          description: "Pool directories are appended to current pool base to locate pools",
        },
        "global-pool": {
          group: "Valma environment options:",
          type: "string", default: defaultPaths["global-pool"] || null, global: false,
          description: "Global pool path is the last pool to be searched",
        },
        "bash-completion": {
          group: "Valma environment options:",
          type: "boolean", global: false,
          description: "Output bash completion script",
        },
      });
  },
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
        v: {
          alias: "verbose",
          group: "Universal options:", default: null, count: true, global,
          description: "Be noisy. -vv... -> be more noisy.",
        },
        h: {
          alias: "help",
          group: hiddenGroup, type: "boolean", global,
          description: "Show the main help of the command",
          causes: ["dry-run"],
        },
        d: {
          alias: theme.argument("dry-run"),
          group: hiddenGroup, type: "boolean", global,
          description: "Do not execute but only list all the matching command(s)",
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
        S: {
          alias: theme.argument("show-status"),
          group: "Universal options:", type: "boolean", global, hidden,
          description: "Show the command (S)tatus (description, disable reason or some state)",
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
        L: {
          alias: theme.argument("show-link"),
          group: "Universal options:", type: "boolean", global, hidden,
          description: "Show the command (L)ink path column",
        },
        T: {
          alias: theme.argument("show-target"),
          group: "Universal options:", type: "boolean", global, hidden,
          description: "Show the command (T)arget path column",
        },
        I: {
          alias: theme.argument("show-introduction"),
          group: "Universal options:", type: "boolean", global, hidden,
          description: "Output the full (I)ntroduction of the command",
        },
        C: {
          alias: theme.argument("show-code"),
          group: "Universal options:", type: "boolean", global, hidden,
          description: "Output the command script source (C)ode",
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
const rootArgv = _vlm.isCompleting ? process.argv.slice(4) : process.argv.slice(2);

let nextContextIndex;

let workspacePath = process.cwd();
while (workspacePath && !_vlm.shell.test("-f", _vlm.path.join(workspacePath, "package.json"))) {
  workspacePath = (workspacePath === "/") ? "" : _vlm.path.join(workspacePath, "..");
}

_vlm._packageConfigStatus = {
  filename: "package.json",
  path: _vlm.path.join(workspacePath || "./", "package.json"),
  workspacePath,
  updated: false,
  createUpdatedContent: currentContent => {
    const reorderedContent = {};
    reorderedContent.name = currentContent.name;
    reorderedContent.version = currentContent.version;
    if (currentContent.valos !== undefined) reorderedContent.valos = currentContent.valos;
    Object.keys(currentContent).forEach(key => {
      if (reorderedContent[key] === undefined) reorderedContent[key] = currentContent[key];
    });
    return reorderedContent;
  },
};

_vlm._toolsetsConfigStatus = {
  filename: "toolsets.json",
  path: _vlm.path.join(workspacePath || "./", "toolsets.json"), workspacePath, updated: false,
};

__addUniversalOptions(globalVargs, { strict: !_vlm.isCompleting, hidden: false });
module.exports.builder(globalVargs);
_vlm.vargs = globalVargs;
_vlm.argv = rootArgv;
_vlm.vargv = _vlm._parseUntilLastPositional(_vlm.argv, module.exports.command);
_vlm._state = _vlm.vargv;

_vlm.verbosity = _vlm.isCompleting || (_vlm.vargv.verbose == null) ? 0 : _vlm.vargv.verbose;
_vlm.interactive = _vlm.isCompleting ? 0 : _vlm.vargv.interactive;

if (_vlm.vargv.echos && !_vlm.isCompleting) {
  nextContextIndex = 0;
  _vlm.contextIndex = nextContextIndex++;
}

if (_vlm.vargv.clock) _vlm.initializeClock();

_vlm.ifVerbose(1)
.babble("phase 1, init:", "determine global options and available pools.",
    `\n\tcommand: ${_vlm.theme.command(_vlm.vargv.commandSelector)
        }, verbosity: ${_vlm.verbosity
        }, interactive: ${_vlm.interactive
        }, echo: ${_vlm.vargv.echo}`,
    "\n\tprocess.argv:", ...process.argv
).ifVerbose(2)
.babble("paths:", "cwd:", process.cwd(),
    "\n\tprocess.env.VLM_GLOBAL_POOL:", process.env.VLM_GLOBAL_POOL,
    "\n\tprocess.env.VLM_PATH:", process.env.VLM_PATH,
    "\n\tprocess.env.PATH:", process.env.PATH,
    "\n\tdefaultPaths:", JSON.stringify(defaultPaths)
).ifVerbose(3)
.expound("global options:", JSON.stringify({ ..._vlm.vargv, vlm: "<hidden>" }));

// When a command begins with ./ or contains the command prefix (if it
// is non-empty) it is considered a direct file valma command.
// Its parent directory is made the initial "file" pool.
let _poolBase = _vlm.vargv["pool-base"];
let _filePoolPath;
let _callForwardedToPool;

if (!_vlm.vargv.commandSelector) {
  _vlm.vargv.commandSelector = (_vlm.vargv.list || _vlm.isCompleting) ? "*" : "$";
} else if (_vlm.vargv.commandSelector.slice(0, 2) === "./") {
  if (_vlm.isCompleting) process.exit(0); // Let bash filename completion do its thing.
  const match = _vlm.vargv.commandSelector.match(/(.*\/)?(\.?)(.*?)(.js)?$/);
  _vlm.vargv.commandSelector = match ? `${match[2]}${match[3]}` : "";
  _filePoolPath = _vlm.path.resolve((match && match[1]) || "");
  _poolBase = _filePoolPath;
}
if (_vlm.vargv.list) {
  // TODO(iridian, 2020-01): Fix this kludge. dry-run should be
  // properly specified and separated from list
  _vlm.vargv["dry-run"] = true;
}
_refreshAvailablePools.call(_vlm);

_vlm.ifVerbose(2)
    .expound("available pools:", _vlm._availablePools);

// Allow --vlm to override any implicit vlm modifications (ie. --vlm.verbosity=100 overrides -v)
if (_vlm.vargv.vlmOption) {
  patchWith(_vlm, _vlm.vargv.vlmOption, { spreaderKey: "..." });
}

process.on("SIGINT", () => {
  if (!_callForwardedToPool) {
    _vlm.exception("killing all child processes", "SIGINT interrupt handler");
  }
  setTimeout(() => process.exit(-1));
});
process.on("SIGTERM", () => {
  if (!_callForwardedToPool) {
    _vlm.exception("killing all child processes", "SIGTERM interrupt handler");
  }
  setTimeout(() => process.exit(-1));
});

process.on("unhandledRejection", error => {
  _vlm.exception(error, "unhandledRejection handler");
});

// Function definitions from hereon until end of the file which contains the main.

function handler (vargv) {
  // Phase 1: Pre-load args with so-far empty pools to detect fully
  // builtin commands (which don't need forwarding).
  const isFullyBuiltin = _vlm.isCompleting || (vargv.help && (vargv.commandSelector === "$"));
  const contextVLM = vargv.vlm;
  if (!isFullyBuiltin) {
    contextVLM.needNPM = (vargv.commandSelector !== "$") && vargv["npm-config-env"]
        && !process.env.npm_package_name;
    contextVLM.needVLMPath = !process.env.VLM_PATH;
  }

  contextVLM.ifVerbose(1)
      .babble("phase 2, main:", "determine active commands, forwards, and do validations.",
          "\n\tfullyBuiltin:", isFullyBuiltin,
              ", needNPM:", contextVLM.needNPM,
              ", needVLMPath:", contextVLM.needVLMPath);

  // Phase 2: Load pools and forward the request to some pool 'vlm' if
  // needed (if a more specific 'vlm' is found or if the node
  // environment or 'vlm' needs to be loaded)

  const isVLMForwardPool = (pool, poolHasVLM, specificEnoughVLMSeen) => {
    const shouldForwardVLM = _vlm.vargv.forward && !isFullyBuiltin && poolHasVLM
        && (specificEnoughVLMSeen ? contextVLM.needVLMPath : vargv.promote);
    contextVLM.ifVerbose(3)
        .babble(`evaluating pool ${pool.path} for VLM forward, result:`, shouldForwardVLM,
            ...(!shouldForwardVLM ? [] : [
              "\n\tvargv.forward:", _vlm.vargv.forward, ", vargv.promote:", _vlm.vargv.promote,
              "\n\tnot fully builtin command:", !isFullyBuiltin,
              "\n\tpool has 'vlm':", poolHasVLM, ", sufficient vlm seen:", specificEnoughVLMSeen,
              "\n\tmissing env.VLM_PATH:", contextVLM.needVLMPath,
            ]));
    if (!shouldForwardVLM) return undefined;
    Object.assign(process.env, {
      VLM_PATH: process.env.VLM_PATH || pool.path,
      VLM_GLOBAL_POOL: process.env.VLM_GLOBAL_POOL || _vlm.vargv["global-pool"],
      INIT_CWD: process.cwd(),
      PATH: `${[
        pool.path,
        contextVLM._activePools[contextVLM._activePools.length - 1].path,
        contextVLM._activePools[0].path,
      ].join(":")}:${process.env.PATH}`,
      _: contextVLM.path.join(pool.path, "vlm"),
    });
    pool.vlmPath = path.join(pool.path, "vlm");
    return [pool];
  };

  const chainRet = thisChainEagerly(contextVLM, [isVLMForwardPool], [
    _refreshActivePools,
    _maybeForwardToPoolVLM,
    _loadNPMConfigVariables,
    _reloadPackageAndToolsetsConfigs,
    _validateEnvironment,
    function _rootInvoke () {
      return this.invoke(this.vargv.commandSelector, this.vargv._, {
        suppressEcho: true,
        processArgs: false,
        flushConfigWrites: !_vlm.isCompleting,
      });
    },
    function _handlerFinalize (ret) {
      return !_vlm.isCompleting && ret;
    },
  ]);
  return chainRet;
  /*
  const subVLM = Object.create(contextVLM);
  subVLM.contextVargv = vargv;
  const maybeRet = subVLM.invoke(vargv.commandSelector, vargv._);
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


/**
 * Execute given executable as per child_process.spawn.
 * Extra options:
 *   noDryRun: if true this call will be executed even if --dry-run is requested.
 *   dryRunResult: during dry runs this call will return immediately with the value of this option.
 *
 * All argv must be strings, all non-strings and falsy values will be filtered out.
 *
 * @param {*} executable
 * @param {*} [argv=[]]
 * @param {*} [spawnOptions={}]
 * @returns
 */
function execute (args, options = {}) {
  this._flushPendingConfigWrites();
  _refreshActivePools.call(this);
  const argv = __processArgs(args, options);
  if ((argv[0] === "vlm") && !Object.keys(options).length) {
    // TODO(iridian, 2020-06): invoke now in principle supports options
    // forwarding via _state flags. The above constraint on not having
    // options in order to do the in-process-forward could be thus
    // removed after some formalizing.
    argv.shift();
    const vargv = this._parseUntilLastPositional(argv, module.exports.command);
    return this.invoke(vargv.commandSelector, vargv._,
        { processArgs: false, flushConfigWrites: true, delegate: options.delegate });
  }
  const isDryRun = options.dryRun
      || ((options.dryRun !== false) && this.vargv && this.vargv["dry-run"]);
  const executionVLM = Object.create(this);
  ++executionVLM.taskDepth;
  const executorIndexText = this.getContextIndexText();
  const executionIndexText = executionVLM.getContextIndexText();
  return thisChainEagerly(executionVLM, [], [
    function _preExecute () {
      this.echo(`${executorIndexText}>> ${executionIndexText}vlm @`,
          `${this.theme.executable(...argv)}`);
      if (isDryRun) {
        this.echo("dry-run: skipping execution and returning:",
        this.theme.blue(options.dryRunResult));
        return thisChainRedirect("_postExecute", [null, 0, undefined, options.dryRunResult]);
      }
      return {
        stdio: options.delegate
            ? ["ignore", "pipe", "pipe"]
            : [0, options.asTTY ? 1 : "pipe", 2],
        detached: false,
        ...options.spawn,
      };
    },
    function _spawnExecuteProcess (spawnOptions) {
      return new Promise(resolveToOnExecuteDone => {
        this.ifVerbose(3)
            .babble(`spawning child process "${argv[0]}" with options:`, spawnOptions);
        const finalArgv = !spawnOptions.shell ? argv
            : __processArgs(args, { ...options, shellEscapeChar: "'" });

        const subProcess = childProcess.spawn(finalArgv[0], finalArgv.slice(1), spawnOptions);
        const stdout = !options.asTTY && _readStreamContent(subProcess.stdout);
        // TODO(iridian): Implement stderr.isTTY faking on the child process side,
        // so that client scripts emit colors
        const stderr = options.delegate && _readStreamContent(subProcess.stderr);
        subProcess.on("exit",
            (code, signal) => resolveToOnExecuteDone([null, code, signal, stdout, stderr]));
        subProcess.on("error",
            error => resolveToOnExecuteDone([error, undefined, undefined, stdout, stderr]));
        if (options.onProcess) options.onProcess(subProcess);
        process.on("SIGINT", _killSubProcess);
        process.on("SIGTERM", _killSubProcess);
        if (options.terminateOnceTruthy) {
          thenChainEagerly(options.terminateWhenTruthy,
              shouldTerminate => shouldTerminate && _killSubProcess());
        }
        function _killSubProcess () {
          _vlm.warn(`vlm (pid ${process.getgid()}) killing pid ${subProcess.pid}:`,
              _vlm.theme.green(...argv));
          process.kill(-subProcess.pid, "SIGTERM");
          process.kill(-subProcess.pid, "SIGKILL");
        }
      });
    },
    function _postExecute (error, code, signal, stdout, stderr) {
      let result;
      let output = stdout;
      if (error) {
        result = error;
      } else if (code || signal) {
        if (options.onFailure !== undefined) {
          result = (typeof options.onFailure !== "function")
              ? options.onFailure
              : options.onFailure(code, signal);
        } else {
          result = (typeof stderr === "string") && (options.stderr === "erroronly")
              ? new Error(stderr.split("\n")[0])
              : new Error(`received ${signal ? "signal" : "code"} ${signal || code}`);
          result.code = code;
          result.signal = signal;
        }
      } else {
        if (options.stdout === "json") {
          try {
            output = JSON.parse(stdout);
          } catch (parseError) {
            result = wrapError(parseError, new Error("During JSON.parse(executeStdOut)"));
          }
        }
        _refreshAvailablePools.call(this);
        _refreshActivePools.call(this);
        _reloadPackageAndToolsetsConfigs();
        result = (options.onSuccess === undefined) ? output
            : (typeof options.onSuccess !== "function") ? options.onSuccess
            : options.onSuccess(output);
      }
      if ((typeof stderr === "string") && stderr) {
        if (result instanceof Error) result.stderr = stderr;
        if (options.stderr !== "erroronly") {
          this.echo(
              `${executorIndexText}// ${executionIndexText}$`,
              `${this.theme.executable(argv[0])}, diagnostics/stderr output (${
                  stderr.length} chars):`);
          const indent = " ".repeat((this.taskDepth * 2) - 1);
          this.speak(indent, stderr.replace(/\n/g, `\n${indent} `));
        }
      }
      this.echo(
          `${executorIndexText}<< ${executionIndexText}vlm @`,
          `${this.theme.executable(argv[0])}:`,
          _peekReturnValue(this, result, 71));
      if (result instanceof Error) {
        result.stdout = output || stdout;
        throw result;
      }
      return thisChainReturn(result);
    }
  ], function _onExecuteError (error) {
    this.echo(`${executorIndexText}<< ${executionIndexText}vlm @`,
        `${this.theme.executable(argv[0])}:`,
        this.theme.error("exception:", String(error)));
    return _inquireErrorForRetry(this, error,
        `Exception received from execute: ${error.message}`, [
          {
            name: `Re-execute ${this.theme.executable(...argv)}`,
            value: () => thisChainRedirect("_preExecute")
          },
          ...(options.retryChoices || []),
        ],
        innerError => wrapError(innerError,
            error.chainContextName(`During vlm.execute(${this.theme.executable(...argv)})`),
            "\n\targv:", ...dumpObject(argv),
            "\n\toptions:", ...dumpObject(options)));
  });
}

function _readStreamContent (stream) {
  return new Promise((resolve, reject) => {
    if (!stream.readable) reject(new Error("stream not readable"));
    else {
      let contentBuffer = "";
      stream.on("data", (chunk) => { contentBuffer += chunk; });
      stream.on("end", () => { resolve(contentBuffer); });
      stream.on("error", () => reject);
    }
  });
}

function _inquireErrorForRetry (vlm, error, prompt, choices, onError) {
  if (error.valmaRetry === false) throw error;
  return vlm.inquireConfirm(`${prompt}.\nInspect manually before continuing?`, false)
  .then(inspect => {
    if (!inspect) _rethrow();
    return _inquireOptions();
  });
  function _rethrow (valmaRetry = false) {
    const outerError = !onError ? error : onError(error);
    outerError.valmaRetry = valmaRetry;
    throw outerError;
  }
  function _inquireOptions () {
    return vlm.inquire([{
      message: `Choose a resolution for the exception:`,
      type: "list", name: "choice", default: choices[0],
      choices: [
        { value: "accept", name: "Accept and rethrow (no further inspections)" },
        { value: "postpone", name: "Postpone and rethrow (inspect by outer handler)" },
        { value: "inspect", name: "Inspect error (then choose again)" },
        ...choices,
      ],
    }])
    .then(answer => {
      if (typeof answer.choice === "function") return answer.choice();
      if (answer.choice === "inspect") {
        outputError(error, "When manually inspecting an error");
        return _inquireOptions();
      }
      return _rethrow(answer.choice !== "accept");
    });
  }
}

function delegate (args, options = {}) {
  return execute.call(this, args, { delegate: true, ...options });
}

function interact (args, options = {}) {
  return execute.call(this, args, { asTTY: true, onSuccess: true, ...options });
}

function invoke (commandSelectorArg, args, options = {}) {
  if (!commandSelectorArg) {
    throw new Error(`vlm.invoke: commandSelector missing`);
  }
  const invokationVLM = Object.create(this);
  ++invokationVLM.taskDepth;
  invokationVLM.contextVLM = this;
  invokationVLM._state = Object.create(this._state);
  const { processArgs, flushConfigWrites, suppressEcho, ...flagsOverrides } = options;
  Object.assign(invokationVLM._state, flagsOverrides);

  // Remove everything after space so that exports.command can be given
  // as commandSelector as-is (these often have yargs usage arguments
  // after the command selector itself).
  const commandSelector = commandSelectorArg.split(" ")[0];
  const argv = (processArgs !== false) ? __processArgs(args, options) : args;

  const invokerIndexText = this.getContextIndexText();
  const invokationIndexText = invokationVLM.getContextIndexText();

  const invokeSignatureText = this.theme.vlmCommand("vlm", _getSelectorText());
  const fullInvokeSignatureText = this.theme.vlmCommand("vlm", _getSelectorText(), ...argv);
  return thisChainEagerly(invokationVLM, [], [
    function _preInvoke () {
      if (!suppressEcho) {
        this.echo(`${invokerIndexText}>> ${invokationIndexText}${fullInvokeSignatureText}`);
      }
      return [commandSelector, argv];
    },
    _invoke,
    function _postInvoke (result) {
      if (!suppressEcho) {
        this.echo(`${invokerIndexText}<< ${invokationIndexText}${invokeSignatureText}:`,
            _peekReturnValue(this, result, 71));
      }
      if (flushConfigWrites) {
        this._flushPendingConfigWrites();
        _reloadPackageAndToolsetsConfigs();
      }
      return thisChainReturn(result);
    },
  ], function _onInvokeError (error) {
    if (!suppressEcho) {
      this.echo(`${invokerIndexText}<< ${invokationIndexText}${invokeSignatureText}:`,
          this.theme.error("exception:", String(error)));
    }
    return _inquireErrorForRetry(this, error,
        `Exception received from invoke: ${error.message}`, [
          {
            name: "retry",
            description: `Re-invoke ${fullInvokeSignatureText}`,
            value: () => thisChainRedirect("_preInvoke"),
          },
          ...(options.retryChoices || []),
        ],
        innerError => wrapError(innerError,
            error.chainContextName(`During $ ${fullInvokeSignatureText}`),
            "\n\targv:", ...dumpObject(...argv),
            "\n\toptions:", ...dumpObject(options)));
  });
  function _getSelectorText () {
    return __isWildcardCommand(commandSelector) ? `'${commandSelector}'` : commandSelector;
  }
}

function _peekReturnValue (vlm, value, clipLength) {
  let ret;
  if ((typeof value === "object") && value && !Array.isArray(value)
      && Object.getPrototypeOf(value) !== Object.prototype) {
    if (value instanceof Error) {
      ret = value.message;
      ret = `<Error: ${ret.length <= clipLength ? ret : `${ret.slice(0, clipLength - 9)}...`}>`;
    } else {
      ret = "<complex object>";
    }
  } else if (value === undefined) {
    ret = "<undefined>";
  } else if (typeof value === "function") {
    ret = `<function ${value.name}>`;
  } else {
    ret = dumpify(value);
  }
  return vlm.theme.return(ret.length <= clipLength ? ret : `${ret.slice(0, clipLength)}...`);
}

function _invoke (commandSelector_, argv) {
  if (!Array.isArray(argv)) {
    throw new Error(`vlm.invoke: argv must be an array, got ${typeof argv}`);
  }
  if (!this || !this.ifVerbose) {
    throw new Error(`vlm.invoke: 'this' must be a valid vlm context`);
  }

  const contextVargv = this.contextVLM.vargv;

  if (this.isCompleting || contextVargv["bash-completion"]) {
    globalVargs.completion("bash-completion", (current, argvSoFar) => {
      const rule = __globFromSelector(argvSoFar._[1], {
        infixSelect: argvSoFar.list, prefixSelect: true, revealHidden: argvSoFar["reveal-hidden"],
      });
      const ret = [].concat(...this._activePools.map(pool => pool.listing
          .map(node => !__isDirectory(node) && commandFromFilename(node.name || ""))
          .filter(command => minimatch(command, rule, { dot: argvSoFar["reveal-hidden"] }))));
      return ret;
    });
    globalVargs.parse(
        contextVargv["bash-completion"] ? ["bash-completion"] : process.argv.slice(2));
    return 0;
  }

  const isWildcardCommand = __isWildcardCommand(commandSelector_) || contextVargv.list;
  const introspection = this.contextVLM._determineIntrospection(module.exports, commandSelector_, {
    topLevel: true,
    isExact: !isWildcardCommand,
    rawArgv: this.contextVLM.argv,
  });
  const commandSelector = ((introspection || {}).defaultUsage && (commandSelector_ === "$")) ? "*"
      : commandSelector_;
  const commandGlob = __globFromSelector(commandSelector, {
    infixSelect: contextVargv.list,
    prefixSelect: this.isCompleting,
    revealHidden: contextVargv["reveal-hidden"],
  });

  // Phase 3: filter available command pools against the command glob

  this.ifVerbose(1)
      .babble("phase 3, invoke", this.theme.command(commandGlob, ...argv),
          "\n\tisWildcard:", isWildcardCommand, ", introspection:", !!introspection);
  this.ifVerbose(2)
      .expound("introspection:", introspection)
      .expound("contextVargv:", JSON.stringify({ ...contextVargv, vlm: "<hidden>" }));

  const activeCommands = this._selectActiveCommands(
      commandGlob, argv, introspection, isWildcardCommand);

  this.ifVerbose(2)
      .expound("activeCommands: {", ...Object.keys(activeCommands).map(
              key => `\n\t\t${key}: ${activeCommands[key].linkPath}`),
          "\n\t}");

  if (introspection) {
    return [introspection.builtinHelp
        ? this._renderBuiltinHelp(introspection)
        : this._introspectCommands(introspection, activeCommands, commandGlob, isWildcardCommand,
            this.contextVLM._state["enable-disabled"])];
  }

  if (!isWildcardCommand) {
    if (!Object.keys(activeCommands).length) {
      this.error(
          `Cannot find command '${this.theme.command(commandSelector)}' from active pools:`,
          ...this._activePools.map(
              activePool => `\n\t"${this.path.join(activePool.path, commandGlob)}"`));
      return -1;
    }
    Object.values(activeCommands)[0].vlm.contextIndex += 0;
  }

  // Phase 4: Dispatch the command(s)
  this.ifVerbose(1)
      .babble("phase 4, dispatch:",
          this.theme.command(commandGlob, ...argv),
          "\n\tactive commands:",
          ...Object.keys(activeCommands).map(c => this.theme.command(c)));
  globalVargs.help();
  return [_dispatchCommands.call(this, commandSelector, argv, activeCommands, isWildcardCommand)];
}

async function _dispatchCommands (commandSelector, argv, activeCommands, isWildcardCommand) {
  const contextVargv = this.contextVLM.vargv;
  const dryRunCommands = contextVargv["dry-run"] && {};
  let ret = [];

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
        subVLM.error(`missing symlink target for`, subVLM.theme.command(commandName),
            "ignoring command script at", activeCommand.linkPath);
        continue;
      }

      const subVLM = activeCommand.vlm;
      subVLM.vargv = subVLM._parseUntilLastPositional(argv, module.command, activeCommand.broken);
      if (subVLM.vargv.verbose != null) {
        subVLM.verbosity = subVLM.vargv.verbose;
      }
      const subIntrospection = subVLM._determineIntrospection(module, commandName, {
        isExact: true, rawArgv: argv,
      });

      subVLM.ifVerbose(3)
          .babble("parsed:", subVLM.theme.command(commandName, ...argv),
              activeCommand.disabled ? `: disabled, ${activeCommand.disabled}` : ""
      ).ifVerbose(4)
          .expound("\tsubArgv:", JSON.stringify({ ...subVLM.vargv, vlm: "<hidden>" }))
          .expound("\tsubIntrospect:", subIntrospection);

      if (subIntrospection) {
        ret = ret.concat(subIntrospection.builtinHelp
            ? activeCommand.vlm._renderBuiltinHelp(subIntrospection)
            : subVLM._introspectCommands(subIntrospection, { [commandName]: activeCommand },
                commandSelector, isWildcardCommand, subVLM._state["enable-disabled"]));
      } else if (activeCommand.broken) {
        if (!isWildcardCommand && !_vlm._state["force-broken"]) {
          subVLM.warn(`Skipping invokation of broken command '${commandName}':`,
              `${activeCommand.broken}`);
        } else if (activeCommand.broken instanceof Error) {
          throw wrapError(activeCommand.broken,
              new Error(`During force-invokation of a broken command '${commandName}'`));
        } else {
          throw new Error(`Trying to invoke broken command '${commandName}': ${
              activeCommand.broken}`);
        }
        continue;
      } else if (isWildcardCommand && activeCommand.disabled) {
        subVLM.ifVerbose(1)
            .info(`Skipping disabled command '${subVLM.theme.command(commandName)}'`,
                `during wildcard invokation (${activeCommand.disabled})`);
        continue;
      } else {
        if (activeCommand.disabled) {
          subVLM.warn(`Invoking a disabled command '${commandName}' explicitly`,
              `(${activeCommand.disabled})`);
        }
        try {
          if (isWildcardCommand) {
            subVLM.echo(`${this.getContextIndexText()}>>* ${subVLM.getContextIndexText()}${
              subVLM.theme.vlmCommand("vlm", commandName, ...argv)}`);
          }
          if (subVLM.toolset) {
            const requiresPath = ["commands", commandName, "requires"];
            const tool = subVLM.tool;
            const requires = tool
                ? subVLM.getToolConfig(subVLM.toolset, tool, ...requiresPath)
                : subVLM.getToolsetConfig(subVLM.toolset, ...requiresPath);
            let requireResult = true;
            for (let i = 0; requireResult && (i !== (requires || []).length); ++i) {
              const header = `tool${tool ? "Config" : "setConfig"}.requires[${i}] of ${
                subVLM.theme.command(commandName)}`;
              try {
                subVLM.echo(`${subVLM.getContextIndexText()}>>>? ${header}`, "via",
                    ...(tool ? ["tool", subVLM.theme.package(tool), "of"] : []),
                    "toolset", subVLM.theme.package(subVLM.toolset));
                requireResult = await subVLM.execute(
                    requires[i], { onSuccess: true, onFailure: false });
              } catch (error) {
                requireResult = subVLM.error(`<exception>: ${String(error)}`);
                throw error;
              } finally {
                subVLM.echo(`${subVLM.getContextIndexText()}<<<? ${header}:`,
                _peekReturnValue(subVLM, requireResult, 51));
              }
              if (typeof requireResult === "string" ? requireResult : !requireResult) {
                const message = `'${subVLM.theme.command(commandName)
                    }' as it can't satisfy requires[${i}]: ${subVLM.theme.executable(requires[i])}`;
                if (!isWildcardCommand) {
                  throw new Error(`Failed command ${message}`);
                }
                subVLM.error(`Skipping command ${message}`);
                ret.push(`Skipped command ${message}`);
              }
            }
            if (!requireResult) continue;
          }
          const simpleCommand = commandName.match(/\.?([^/]*)$/)[1];
          const detailCommandPrefix = commandName.replace(/.?[^/]*$/, `.${simpleCommand}`);
          const preCommands = `${detailCommandPrefix}/.pre/**/*`;
          if (this.listMatchingCommands(preCommands).length) {
            await subVLM.invoke(preCommands);
          }
          await subVLM._fillVargvInteractively();
          ret.push(await module.handler(subVLM.vargv));
          const postCommands = `${detailCommandPrefix}/.post/**/*`;
          if (this.listMatchingCommands(preCommands).length) {
            await subVLM.invoke(postCommands);
          }
        } finally {
          if (subVLM.echo && (commandName !== commandSelector)) {
            let retValue = JSON.stringify(ret[ret.length - 1]);
            if (retValue === undefined) retValue = "undefined";
            if (isWildcardCommand) {
              subVLM.echo(`${this.getContextIndexText()}<<* ${subVLM.getContextIndexText()}${
                subVLM.theme.vlmCommand("vlm", commandName)}:`,
                _peekReturnValue(subVLM, retValue, 40));
            }
          }
        }
      }
    }
  }
  if (dryRunCommands) {
    this._introspectCommands(
        this.contextVLM._determineIntrospection(module, "", { isExact: false }),
        dryRunCommands, commandSelector, isWildcardCommand,
        this.contextVLM._state["enable-disabled"]);
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

function _parseUntilLastPositional (argv_, commandUsage, isBroken) {
  const usageParts = commandUsage.split(" ");
  const positionalNames = usageParts.slice(1)
      .filter(param => (param[1] !== "-"))
      .map(positional => positional.match(/^[[<]?([^<>[\]]*)[\]>]?$/)[1]);
  const lastVariadicName = positionalNames.length
      && (positionalNames[positionalNames.length - 1].match(/^(.*)\.\.$/) || [])[1];
  if (lastVariadicName) positionalNames.pop();
  let positionalArgsRemaining = positionalNames.length;
  const endIndex = argv_.findIndex(arg => (arg === "--")
      || (!positionalArgsRemaining && positionalNames.length)
      || ((arg[0] !== "-") && (positionalArgsRemaining-- <= 0)));
  const args = argv_.slice(0, (endIndex === -1) ? undefined : endIndex);
  if (lastVariadicName && (endIndex >= 0)) args.push("dummy");
  this.vargs.$0 = this.theme.command(usageParts[0]);
  const ret = !isBroken ? this.vargs.parse(args) : { _: [] };
  if (ret._.length) {
    for (const positionalName of positionalNames) ret[positionalName] = ret._.shift();
  }
  ret._.push(...((endIndex === -1) ? [] : argv_.slice(endIndex)));
  if (lastVariadicName) {
    ret[lastVariadicName] = ret._;
    ret._ = [];
  }
  if (ret.vlm) ret.vlmOption = ret.vlm;
  ret.vlm = this;
  return ret;
}

// eslint-disable-next-line no-bitwise
function __isDirectory (candidate) { return candidate.mode & 0x4000; }

function __isWildcardCommand (commandSelector) {
  return (commandSelector === "$") || isGlob(commandSelector);
}

function isGlob (maybeGlob) {
  return (maybeGlob.indexOf("*") !== -1) || (maybeGlob.indexOf("{") !== -1);
}

function commandFromFilename (filename) {
  if (!filename.startsWith(_filenamePrefix)) return undefined;
  return filename.slice(_filenamePrefix.length)
      .replace(/^./, "_")
      .replace(/__-/g, "/.@")
      .replace(/__/g, "/.")
      .replace(/_-/g, "/@")
      .replace(/_/g, "/")
      .slice(1);
}

function filenameFromCommand (command) {
  return `${_filenamePrefix}/${command}`
          .replace(/\/\.@/g, "__-")
          .replace(/\/\./g, "__")
          .replace(/\/@/g, "_-")
          .replace(/\//g, "_");
}

function __globFromSelector (commandSelector = "", {
  infixSelect, prefixSelect, revealHidden,
} = {}) {
  const prefixGlob = infixSelect ? "{,*/**/}*"
      : (revealHidden && (commandSelector[0] !== ".")) ? "{.,}"
      : "";
  const suffixGlob = (infixSelect || prefixSelect) ? "{,*/**/}*" : "";
  return `${prefixGlob}${commandSelector}${suffixGlob}`;
}

function _refreshAvailablePools () {
  this._availablePools.splice(0, this._availablePools.length);
  if (_filePoolPath) {
    this._availablePools.push({ name: "file", path: _filePoolPath });
  }
  this._availablePools.push(..._locateDependedPools.call(this,
      _poolBase,
      _vlm.vargv["pool-subfolders"],
      _poolBase === path.posix.resolve(".") ? "." : _poolBase));
  this._availablePools.push({ name: "global", path: _vlm.vargv["global-pool"] });
}

function _locateDependedPools (initialPoolBase, poolFolders, relativePoolBase) {
  // TODO(iridian): eventually make this function less singleton-y to
  // allow for different sub-invokations from different directories.
  // Now the pools are searched fixed to the pools available in the
  // initial current working directory (cwd).
  let pathBase = initialPoolBase, relativePathBase = relativePoolBase;
  let packageConfigStatus = this._packageConfigStatus;
  let toolsetsStatus = this._toolsetsConfigStatus;
  const ret = [];
  let poolsMissingNodeModules = !_vlm.vargv["bypass-validations"] && [];
  while (pathBase) {
    const packageJSONPath = this.path.join(pathBase, "package.json");
    if (shell.test("-f", packageJSONPath)) {
      const dirName = pathBase.match(/([^/]*)\/?$/)[1];
      const name = this.path.join(relativePathBase, "..", dirName);
      let packageConfig;
      try {
        packageConfig = require(packageJSONPath);
      } catch (error) {
        throw wrapError(
            new Error(`Could not load package.json for pool ${name}!`),
            new Error(`_locateDependedPools("${initialPoolBase}")`),
            "\n\tPool commands not loaded. Some dependent commands will likely be missing.",
            "\n\tload error:", ...dumpObject(error));
      }
      poolFolders.forEach(candidateFolderName => {
        const poolPath = this.path.join(pathBase, candidateFolderName);
        if (shell.test("-d", poolPath)) {
          const pool = { name, path: poolPath, packageConfig };
          if (poolsMissingNodeModules && ((pool.packageConfig.valos || {}).type === "vault")) {
            poolsMissingNodeModules = [];
          }
          ret.push(pool);
        } else if (candidateFolderName === "node_modules") {
          (poolsMissingNodeModules || []).push(name);
        }
      });
      if (packageConfigStatus) {
        packageConfigStatus = packageConfigStatus.parent = {
          path: packageJSONPath,
          content: packageConfig,
          updated: null,
        };
      }
      const toolsetsJSONPath = this.path.join(pathBase, "toolsets.json");
      if (toolsetsStatus && shell.test("-f", toolsetsJSONPath)) {
        toolsetsStatus = toolsetsStatus.parent = {
          path: toolsetsJSONPath,
          content: require(toolsetsJSONPath),
          updated: null,
        };
      }
    }
    if (pathBase === "/") break;
    pathBase = this.path.join(pathBase, "..");
    relativePathBase = this.path.join(relativePathBase, "..");
  }
  if ((poolsMissingNodeModules || []).length) {
    this.warn(`Module pools are missing node_modules:`, poolsMissingNodeModules,
        "\n\tSome dependent commands will likely be missing.",
        `Execute '${this.theme.executable("yarn install")
            }' to make dependent commands available.\n`);
  }
  return ret;
}

function _refreshActivePools (searchForwardPool) {
  // TODO(iridian): same as _locateDependedPools: make _activePools properly context dependent.
  // Now splicing so that only the root _vlm._activePools is affected.
  this._activePools.splice(0, this._activePools.length);
  let specificEnoughVLMSeen = false;
  let ret;
  for (const pool of this._availablePools) {
    if (!pool.path || !shell.test("-d", pool.path)) {
      this.ifVerbose(1)
          .warn(`Not adding available pool '${pool.name}' to active pools:`,
              !pool.path
                  ? `pool.path (${pool.path}) is falsy`
                  : "path doesn't exist");
      continue;
    }
    let poolHasVLM = false;
    pool.listing = shell.ls("-lAR", pool.path)
        .filter(file => {
          if (file.name.startsWith(_filenamePrefix)) return true;
          if (file.name === "vlm") poolHasVLM = true;
          return false;
        });
    this._activePools.push(pool);
    if (process.argv[1].indexOf(pool.path) === 0) specificEnoughVLMSeen = true;
    ret = ret || (searchForwardPool && searchForwardPool(pool, poolHasVLM, specificEnoughVLMSeen));
  }
  return ret;
}

function _selectActiveCommands (commandGlob, argv, introspection, isWildcardCommand) {
  if (((introspection || {}).aggregatePool || {}).commands) {
    return introspection.aggregatePool.commands;
  }
  const ret = {};
  const matchDots = this.vargv["reveal-hidden"];
  for (const pool of this._activePools) {
    if (!pool.commands) pool.commands = {};
    pool.stats = {};
    this.ifVerbose(2)
        .info(`   filtering ${pool.listing.length} pool ${this.theme.name(pool.name)
          } entries for ${matchDots ? "all" : "public"} commands matching glob:`,
            this.theme.command(commandGlob));
    pool.listing.forEach(file => {
      const commandName = commandFromFilename(file.name);
      if (!commandName || __isDirectory(file)) return;
      const matches = minimatch(commandName, commandGlob, { dot: matchDots });
      this.ifVerbose(3)
          .info(`     evaluating command ${this.theme.command(commandName)}:`, matches
              ? this.theme.success("included")
              : this.theme.failure("excluded"));
      if (!matches) {
        pool.stats.nonmatching = (pool.stats.nonmatching || 0) + 1;
        return;
      }

      const poolCommand = pool.commands[commandName]
          || (pool.commands[commandName] = __loadCommand(commandName, pool, file));
      if (ret[commandName]) {
        this.ifVerbose(3)
            .babble("       skipping overridden module");
        pool.stats.overridden = (pool.stats.overridden || 0) + 1;
        return;
      }
      if (poolCommand.module) {
        this.ifVerbose(3)
            .babble("       module already previously found");
      } else if (!shell.test("-e", poolCommand.linkPath)) {
        this.ifVerbose(3)
            .babble(this.theme.failure("       module link target not found at:",
                this.theme.path(poolCommand.linkPath)));
      } else {
        this.ifVerbose(3)
            .babble(`       module newly linked from:`,
                this.theme.path(poolCommand.linkPath));
        try {
          if (poolCommand.disapproved) throw new Error(poolCommand.disapproved);
          poolCommand.module = require(poolCommand.linkPath);
        } catch (error) {
          if (!this.isCompleting && !introspection && !this.vargv["dry-run"]) throw error;
          poolCommand.module = false;
          poolCommand.disabled = poolCommand.broken = error;
          poolCommand.explanation = `module require threw: ${String(error)}`;
          this.ifVerbose(this.vargv["dry-run"] ? 0 : 1)
              .exception(error, `require() for command '${commandName}' at "${
                  poolCommand.linkPath}"`);
        }
      }
      const module = poolCommand.module;
      if (!module || !module.command || !module.describe || !module.handler) {
        if (this.isCompleting || introspection || this.vargv["dry-run"]) {
          ret[commandName] = { ...poolCommand };
          return;
        }
        throw new Error(`invalid command '${commandName}' (via link '${poolCommand.linkPath}'): ${
            !module ? String(poolCommand.broken || "can't open target for reading")
            : !module.command ? "script exports.command is falsy"
            : !module.describe ? "script exports.describe is falsy"
            : "script exports.handler is falsy"}`);
      }

      const subVargs = __createVargs(argv);
      __addUniversalOptions(subVargs, { global: true, hidden: !_vlm.vargv.help });

      subVargs.vlm = Object.assign(Object.create(this),
          module.vlm,
          { contextCommand: commandName, vargs: subVargs });
      ++subVargs.vlm.taskDepth;

      const activeCommand = {
        ...poolCommand,
        vlm: subVargs.vlm,
        disabled: poolCommand.disabled || (module.disabled && (
            (typeof module.disabled !== "function")
                ? `.disabled == ${String(module.disabled)}`
            : (module.disabled(subVargs)
                && `.disabled => ${String(module.disabled(subVargs))}`))),
      };
      ret[commandName] = activeCommand;

      try {
        if (!module.builder || !module.builder(subVargs)) {
          if (!activeCommand.broken) activeCommand.broken = ".builder => falsy";
          if (!activeCommand.disabled) activeCommand.disabled = ".builder => falsy";
        }
      } catch (error) {
        activeCommand.disabled = activeCommand.broken = error;
        activeCommand.explanation = `.builder threw: ${String(error)}`;
      }
      const exportedCommandName = module.command.match(/^([^ ]*)/)[1];
      const lengthDiff = commandName.length - exportedCommandName.length;
      if ((lengthDiff < 0) || (commandName.slice(lengthDiff) !== exportedCommandName)) {
        this.warn(`Command name mismatch between exported command name '${
            this.theme.command(exportedCommandName)}' and command name '${
            this.theme.command(commandName)}' inferred from file:`, file.name);
      }

      const description = _generateModuleDescription(module, { full: !isWildcardCommand });

      subVargs.usage(module.command.replace(exportedCommandName, "$0"), description);
      if (!activeCommand.disabled
          || this._state[activeCommand.broken ? "force-broken" : "enable-disabled"]) {
        globalVargs.command(module.command, description,
            ...(!activeCommand.disabled && module.builder ? [module.builder] : []), () => {});
      } else {
        pool.stats.disabled = (pool.stats.disabled || 0) + 1;
      }
      this.ifVerbose(4)
          .babble(`    with command info:`, {
              ...activeCommand, vlm: "<hidden>", file: "<hidden>",
              pool: { ...activeCommand.pool, listing: "<hidden>", commands: "<hidden>" },
          });
    });
  }
  return ret;
}

const _packageJSONLookup = {};

function __loadCommand (name, pool, file, extraFields = {}) {
  const ret = { name, pool, file, ...extraFields };
  if (!ret.linkPath && file) ret.linkPath = _vlm.path.join(pool.path, file.name);
  if (!ret.targetPath) {
    if (!ret.linkPath || !shell.test("-e", ret.linkPath)) return ret;
    ret.targetPath = fs.realpathSync(ret.linkPath);
  }
  for (let remaining = path.dirname(ret.targetPath);
      remaining !== "/";
      remaining = _vlm.path.join(remaining, "..")) {
    const packagePath = _vlm.path.join(remaining, "package.json");
    let packageEntry = _packageJSONLookup[packagePath];
    if (!packageEntry) {
      if (!shell.test("-f", packagePath)) continue;
      packageEntry = _packageJSONLookup[packagePath] =
          JSON.parse(shell.head({ "-n": 1000000 }, packagePath));
      // TODO(iridian, 2020-01): Add package audition & approval flows.
      packageEntry._disapproved = false;
    }
    ret.version = packageEntry.version;
    ret.package = packageEntry.name;
    if (packageEntry._disapproved !== false) {
      ret.disapproved = `package ${ret.package}@${ret.version} disapproved: ${
          packageEntry._disapproved}`;
    }
    break;
  }
  return ret;
}

function _generateModuleDescription (module, { full }) {
  if (!full || (module.introduction === undefined)) {
    return module.describe;
  }
  return `${module.describe}.

${module.introduction}
`;
}

function _maybeForwardToPoolVLM (forwardPool) {
  if (!forwardPool) return undefined;
  const myRealVLM = fs.realpathSync(process.argv[1]);
  const forwardRealVLM = fs.realpathSync(forwardPool.vlmPath);
  process._vlmName = forwardPool.name;
  process.argv[1] = forwardPool.vlmPath;
  if (myRealVLM !== forwardRealVLM) {
    this.ifVerbose(1)
    .info(`forwarding to vlm in another pool via require('${
          this.theme.path(forwardPool.vlmPath)}')`,
        "\n\ttarget pool path:", this.theme.path(forwardPool.path),
        "\n\ttarget vlm real path:", this.theme.path(forwardRealVLM),
        "\n\tcurrent vlm real path:", this.theme.path(myRealVLM));
    // Call is handled by a forward require to another valma.
    _callForwardedToPool = forwardPool;
    require(forwardPool.vlmPath);
    return thisChainReturn(undefined);
  }
  this.ifVerbose(1)
  .info(`skipping forward to vlm in another pool because forward target is the same`,
      "\n\ttarget vlm path symlink:", this.theme.path(forwardPool.vlmPath),
      "\n\tlinks to current vlm real path:", this.theme.path(myRealVLM));
  return undefined;
}

/**
 * Load all npm config variables to process.env as if running valma via 'npx -c'
 * FIXME(iridian): horribly broken.
 */
async function _loadNPMConfigVariables () {
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
  if (!this.needNPM) return;
  if (_vlm.vargv["package-config-env"]) {
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

function _validateEnvironment () {
  if (_vlm.isCompleting || this.vargv["bypass-validations"]) return;
  this.ifVerbose(1)
      .info("active pools:",
          ...[].concat(...this._activePools.map(pool => Object.assign({}, pool, {
            listing: this.verbosity < 3
                ? "<omitted due verbosity < 3>"
                : Array.isArray(pool.listing) && pool.listing.map(entry => entry.name)
          }))),
          "\n");

  if (this.needVLMPath && !process.env.VLM_PATH) {
    this.error("could not find 'vlm' in PATH or in any pool");
    process.exit(-1);
  }

  if (!semver.satisfies(process.versions.node, nodeCheck)) {
    this.warn(`your node version is old (${process.versions.node}):`,
        "recommended to have at least", nodeCheck);
  }

  if (!process.env.npm_config_user_agent) {
    if (this.needNPM && this.getPackageConfig()) {
      this.warn("could not load NPM config environment variables");
    }
  } else {
    const npmVersion = (process.env.npm_config_user_agent || "").match(/npm\/([^ ]*) /);
    if (npmVersion && !semver.satisfies(npmVersion[1], npmCheck)) {
      this.warn(`your npm version is old (${npmVersion[1]})`,
          "recommended to have at least", npmCheck);
    }
  }
}

function listMatchingCommands (commandSelector, { matchDots } = {}) {
  const ret = [].concat(...this._activePools.map(pool => pool.listing
      .map(file => commandFromFilename(file.name))
      .filter(command =>
          command && minimatch(command, commandSelector || "*", { dot: matchDots || false }))
  )).filter((v, i, a) => (a.indexOf(v) === i));
  this.ifVerbose(1)
      .expound(matchDots ? "listAllMatchingCommands:" : "listMatchingCommands:",
          this.theme.command(commandSelector),
          ...(this.verbosity > 1 ? [", minimatcher:", commandSelector || "*"] : []),
          "\n\tresults:", ret);
  return ret;
}

function listAllMatchingCommands (commandSelector) {
  return listMatchingCommands.call(this, commandSelector, { matchDots: true });
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
function __processArgs (args, { shellEscapeChar = "", paramPrefix = "--" } = {}) {
  return [].concat(...[].concat(args).map(entry =>
      ((typeof entry === "string")
          ? entry.split(" ")
      : Array.isArray(entry)
          ? entry.map(e => ((typeof e === "string") ? e : JSON.stringify(e))).join("")
      : _toArgString(entry))));

  function _toArgString (value, keys) {
    if ((value === undefined) || (value === null)) return [];
    if (typeof value === "boolean") {
      return !keys ? [] : `${paramPrefix}${value ? "" : "no-"}${keys.join(".")}`;
    }
    if (Array.isArray(value)) {
      return [].concat(...value.map(entry => _toArgString(entry, keys)));
    }
    if (typeof value !== "object") {
      const str = _maybeEscape((typeof value === "string") ? value : JSON.stringify(value));
      return !keys ? str : `${paramPrefix}${keys.join(".")}=${str}`;
    }
    return [].concat(...Object.keys(value)
        .map(key => ((key[0] === ".") ? [] : _toArgString(value[key], [...(keys || []), key]))));
  }
  function _maybeEscape (str) {
    return !shellEscapeChar ? str : `${
        shellEscapeChar}${
        str.replace(shellEscapeChar, `\\${shellEscapeChar}`)}${
        shellEscapeChar}`;
  }
}

function _determineIntrospection (module, selector, {
  isExact = true, topLevel = false, rawArgv = "",
} = {}) {
  const ret = { module, show: {} };
  let argvString;
  Object.keys(this.vargv).forEach(key => {
    if (this.vargv[key] && (key.slice(0, 5) === "show-")) {
      const infoName = key.slice(5);
      if (!rawArgv || (this.vargv[key] !== true)) {
        ret.show[infoName] = this.vargv[key];
      } else {
        if (!argvString) argvString = JSON.stringify(rawArgv);
        const infoChar = (infoName === "pool") ? "O" : infoName[0].toUpperCase();
        ret.show[infoName] =
            (argvString.indexOf(`--${key} `) !== -1) ? argvString.indexOf(`--${key} `)
            : (argvString.indexOf(infoChar) !== -1) ? argvString.indexOf(infoChar)
            : true;
      }
    }
  });
  if ((_vlm.vargv.help || this.vargv.help) && (!topLevel || (selector === "$"))) {
    return { module, builtinHelp: true };
  }
  ret.hasEntryIntro = !!Object.keys(ret.show).length;
  if (!ret.hasEntryIntro) {
    // show default listing
    if (!this.vargv["dry-run"]) {
      if (selector !== "$") return undefined;
      ret.defaultUsage = true;
    }
    ret.show.pool = 1;
    ret.show.usage = 2;
    ret.show.status = 3;
  } else if ((selector === "$") && !this.vargv.list && !this.vargv["match-all"]) {
    // Introspect context
    ret.aggregatePool = {
      name: process._vlmName || "global", path: path.dirname(process.argv[1]),
      isAggregate: true, commands: {},
    };
    ret.aggregatePool.commands.vlm = __loadCommand(
        "vlm", ret.aggregatePool, { name: "vlm" }, { module });
  }
  if (!this.vargv["pools-breakdown"] && !ret.aggregatePool) {
    ret.aggregatePool = { name: ".", isAggregate: true };
  }
  ret.displayHeaders = !ret.aggregatePool && !isExact;
  if (!ret.show.name && !ret.show.usage) {
    if (this.vargv["dry-run"] && isExact) ret.show.usage = 1;
    else if (!ret.hasEntryIntro) ret.show.name = 1;
  }
  return ret;
}

function _renderBuiltinHelp (introspection) {
  this.vargs.vlm = this;
  this.vargs.$0 = this.theme.command(introspection.module.command.match(/^[^ ]*/)[0]);
  this.vargs.showHelp("log");
  return [];
}

function _introspectCommands (introspection, commands_, commandGlob, isWildcard_, enableDisabled) {
  const chapters = { "...": { chapters: true, entries: [] } };
  const commandsText = `${enableDisabled ? "All known" : "Enabled"} commands${
      introspection.aggregatePool ? "" : " by pool"}:`;

  if (introspection.defaultUsage && !enableDisabled) {
    chapters["..."].entries.push({
      usage: { heading: { text: `Usage: ${introspection.module.command}`, style: "bold" } }
    });
    chapters.usage = "";
  }

  let poolIntro;
  if (introspection.aggregatePool) {
    if (!introspection.aggregatePool.commands) introspection.aggregatePool.commands = commands_;
    poolIntro = this._introspectPool(introspection,
        introspection.aggregatePool, introspection.aggregatePool.commands,
        isWildcard_, enableDisabled);
    if ((poolIntro["..."] || {}).columns.length === 1) poolIntro["..."].hideHeaders = true;
    if (introspection.defaultUsage) {
      markdownify.addLayoutOrderedProperty(chapters, commandsText, poolIntro);
      return chapters;
    }
  } else {
    const pools = { "...": {
      chapters: true,
      heading: { style: "bold", text: introspection.defaultUsage ? commandsText : undefined },
    } };
    markdownify.addLayoutOrderedProperty(chapters, "pools", pools);

    for (const pool of [...this._activePools].reverse()) {
      const subPoolIntro = this._introspectPool(introspection,
          pool, commands_, isWildcard_, enableDisabled);
      markdownify.addLayoutOrderedProperty(pools, pool.name, subPoolIntro);
      const isEmpty = !Object.keys(subPoolIntro).filter(k => (k !== "...")).length;
      if (isWildcard_ && (!isEmpty || _vlm.vargv["pools-breakdown"] || enableDisabled)) {
        subPoolIntro["..."].heading = {
          style: "bold",
          text: `'${this.path.join(pool.name, commandGlob)}' ${
              isEmpty ? "has no shown commands" : "commands:"} (${
                this.theme.info(Object.keys(pool.stats || {}).map(
                      s => `${s}: ${pool.stats[s]}`).join(", "))
              })`
        };
      } else if (isEmpty) {
        subPoolIntro["..."].hide = true;
      }
    }
    if (isWildcard_) return chapters;
    const visiblePoolName = Object.keys(pools).find(
        key => (key !== "...") && !(pools[key]["..."] || {}).hide);
    if (!visiblePoolName) return undefined;
    poolIntro = pools[visiblePoolName];
  }
  const keys = Object.keys(poolIntro).filter(k => (k !== "..."));
  if (isWildcard_ || (keys.length !== 1)) return poolIntro;
  const ret = poolIntro[keys[0]];
  if (typeof ret !== "object" || !ret || Array.isArray(ret)) return ret;
  Object.assign(ret["..."] || (ret["..."] = { chapters: true }),
      { entries: (poolIntro["..."] || {}).columns });
  return ret;
}

function _introspectPool (introspection, pool, selectedCommands, isWildcard, enableDisabled) {
  const _missingFile = "<file_missing>";
  const _missingPackage = "<package_missing>";
  const _columnTemplates = {
    name: { text: "command", style: "command" },
    usage: { style: "command" },
    status: { text: "status or description" },
    description: { transform: { defaultValue: { property: "explanation" } } },
    package: { style: "package" },
    version: { style: "version", transform: { defaultValue: { property: "explanation" } } },
    pool: { text: "pool", order: "reverse" },
    link: { text: "link path", style: "path" },
    target: { text: "target path", style: "path", transform: { defaultValue: _missingFile } },
    introduction: { oob: true, elementStyle: { prefix: "\n", suffix: "\n" } },
    code: { oob: true, elementStyle: "cardinal" },
  };
  const trivialKey = (Object.keys(introspection.show).length === 1)
      && Object.keys(introspection.show)[0];
  const columns = trivialKey
      ? [["", _columnTemplates[trivialKey]]]
      : Object.entries(introspection.show)
          .sort(([, l], [, r]) => (l < r ? -1 : r < l ? 1 : 0))
          .map(([name]) => ([name, _columnTemplates[name]]));

  const poolIntro = { "...": {
    columns, stats: pool.stats, elementStyle: { if: [{ property: "broken" }, "strikethrough"] },
  } };
  poolIntro["..."].entries = Object.keys(pool.commands)
  .map(name => {
    const selectedCommand = selectedCommands[name];
    const poolCommand = pool.commands[name];
    if (!poolCommand
        || !selectedCommand
        || (selectedCommand.disabled
            && isWildcard
            && (poolCommand.broken ? !_vlm.vargv["force-broken"] : !enableDisabled))) {
      return undefined;
    }
    const module = poolCommand.module;
    const rowData = {};
    if (poolCommand.broken) {
      rowData.moduleMissing = true;
      rowData.broken = String(poolCommand.broken);
      rowData.explanation = poolCommand.explanation
          || `Error during require: ${poolCommand.broken}`;
    } else if (!poolCommand.module) {
      rowData.moduleMissing = true;
      rowData.broken = "FILE_MISSING";
      rowData.explanation = `Command link broken: "${poolCommand.linkPath}"`;
    } else if (!module.command || !module.builder || !module.handler) {
      rowData.moduleMissing = true;
      rowData.broken = "NOT_A_COMMAND";
      rowData.explanation = `Command module is missing required exports: '${
        ["command", "builder", "handler"].filter(v => !module[v]).join("', '")
      }'`;
    } else if (selectedCommand.disabled) {
      rowData.disabled = "DISABLED";
      rowData.explanation = selectedCommand.disabled;
    }
    if (!pool.isAggregate && (selectedCommand || { pool }).pool !== pool) {
      rowData.overridden = true;
      rowData.entries = { name: { style: "overridden", }, usage: { style: "overridden " } };
    }
    const _addData = (property, data) => introspection.show[property] && (rowData[property] = data);

    _addData("name", rowData.disabled || rowData.broken ? `(${name})` : name);
    _addData("usage", rowData.broken ? `(${name} <${rowData.broken}>)`
        : rowData.disabled ? `(${module.command})`
        : module.command);
    _addData("status", module
        && (rowData.disabled ? rowData.explanation
            : (typeof module.status === "function") ? `.status => ${module.status(this.vargs)}`
            : module.status ? `.status == ${module.status}`
            : module.describe));
    _addData("description", module && module.describe);
    _addData("package", poolCommand.package);
    _addData("version", poolCommand.version || _missingPackage);
    _addData("pool", poolCommand.pool.name);
    _addData("link", poolCommand.linkPath);
    _addData("target", poolCommand.targetPath || _missingFile);
    if (introspection.show.introduction) {
      const intro = _generateModuleDescription(module, { full: true });
      if (intro === null) {
        this.warn(`Cannot read command '${name}' script introduction from:`,
            poolCommand.targetPath);
      }
      _addData("introduction", intro);
    }
    if (introspection.show.code) {
      const code = !module ? null : String(shell.head({ "-n": 1000000 }, poolCommand.targetPath));
      if (code === null) {
        this.warn(`Cannot read command '${name}' script source code from:`, poolCommand.targetPath);
      }
      _addData("code", code);
    }
    return ([name, trivialKey ? rowData[trivialKey] : rowData]);
  })
  .filter(row => (row !== undefined))
  .sort(([, lData], [, rData]) => {
    if (trivialKey) return lData < rData ? -1 : lData > rData ? 1 : 0;
    for (const [cKey, cTemplate] of columns) {
      if (lData[cKey] !== rData[cKey]) {
        return (lData[cKey] < rData[cKey] ? -1 : 1) * (cTemplate.order === "reverse" ? -1 : 1);
      }
    }
    return 0;
  })
  .map(([name, entry]) => {
    poolIntro[name] = entry;
    return name;
  });
  return poolIntro;
}

async function _fillVargvInteractively () {
  const interactiveOptions = this.vargs.getOptions().interactive;
  if (!this.interactive || !interactiveOptions) {
    // TODO(iridian): Add assertions if some required vargs are not set.
    return this.vargv;
  }
  delete this.vargs.getOptions().interactive;
  const answers = Object.assign({}, this.vargv);
  for (const optionName of Object.keys(interactiveOptions)) {
    const option = interactiveOptions[optionName];
    let questionOptions = option.interactive;
    if (typeof questionOptions === "function") {
      questionOptions = questionOptions(answers);
    }
    questionOptions = await questionOptions;
    const question = Object.assign({}, questionOptions);
    question.array = option.array;
    switch (question.when) {
      case "always":
        break;
      case "if-undefined":
        if (option.type === "boolean" && (answers[optionName] === false)) {
          this.warn(
`boolean option '${optionName}' interactive.when = "if-undefined" is
degenerate as boolean options default to false.
Maybe change option.type to 'any' as it works with if-undefined?`);
        }
        if (answers[optionName] !== undefined) continue;
        break;
      default:
        continue;
    }
    delete question.when;
    if (!question.name) question.name = optionName;
    if (!question.message) {
      question.message = option.description;
      if (question.array) question.message += " (comma-separated)";
    }
    const choices = question.choicesPromise
        ? await question.choicesPromise
        : question.choices || option.choices;

    if (choices) {
      const maxLen = choices.reduce(
          (maxLen_, c) => Math.max(maxLen_, String(_choiceName(c)).length),
          0);
      question.choices = await Promise.all(choices.map(async c => ((typeof c !== "object") ? c : {
        value: c.name,
        ...c,
        name: !c.description ? c.name : `${c.name.padEnd(maxLen)} - ${await c.description}`,
        short: c.short || c.name,
      })));
    }
    if (option.default !== undefined) {
      if (!["list", "checkbox"].includes(question.type)) {
        question.default = option.default;
      } else {
        const oldChoices = [];
        (Array.isArray(option.default) ? option.default : [option.default]).forEach(default_ => {
          const defaultValue = _choiceValue(default_);
          if (!question.choices
              || (question.choices.find(c => _choiceValue(c) === defaultValue) === undefined)) {
            oldChoices.push(default_);
          }
        });
        question.choices = oldChoices.concat(question.choices || []);
        if (question.type === "list") {
          question.default = question.choices.findIndex(e => _choiceValue(e) === option.default);
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
    do {
      Object.assign(answers, await this.inquire([question]));
      if (question.array && (typeof answers[question.name] === "string")) {
        answers[question.name] = !answers[question.name] ? [] : answers[question.name].split(",");
      }
    } while (question.confirm
        && !await question.confirm(answers[question.name], answers, question));
  }
  // FIXME(iridian): handle de-hyphenations, camelcases etc. all other option variants.
  // Now only updating the verbatim option.
  return Object.assign(this.vargv, answers);
}

function _choiceValue (c) {
  return (typeof c === "object") ? c.value : c;
}

function _choiceName (c) {
  return (typeof c === "object") ? c.name : c;
}

function _reloadPackageAndToolsetsConfigs () {
  // TODO(iridian): Implement locally pending config writes. See _flushPendingConfigWrites
  _reloadFileConfig(_vlm._packageConfigStatus);
  _reloadFileConfig(_vlm._toolsetsConfigStatus);
}

function _reloadFileConfig (configStatus) {
  if (configStatus.path && shell.test("-f", configStatus.path)) {
    try {
      configStatus.content = JSON.parse(shell.head({ "-n": 1000000 }, configStatus.path));
      __deepFreeze(configStatus.content);
    } catch (error) {
      _vlm.exception(error, `reading "${configStatus.path}"`);
      throw error;
    }
  }
}

function getPackageConfig (...keys) {
  return this._getConfigAtPath(this._packageConfigStatus.content, keys);
}
function getValOSConfig (...keys) {
  return this._getConfigAtPath(this._packageConfigStatus.content, ["valos", ...keys]);
}
function getToolsetsConfig (...keys) {
  return this._getConfigAtPath(this._toolsetsConfigStatus.content, keys);
}
function getFileConfig (workspaceFile, ...rest) {
  if (typeof workspaceFile !== "string") {
    throw new Error(`Invalid arguments for workspaceFile, expexted string, got ${
        typeof workspaceFile}`);
  }
  const fileConfigStatus = { path: this.path.join(process.cwd(), workspaceFile) };
  _reloadFileConfig(fileConfigStatus);
  return this._getConfigAtPath(fileConfigStatus.content, rest);
}

function findToolsetsConfig (...keys) {
  let ret;
  let configStatus = this._toolsetsConfigStatus;
  do {
    ret = this._getConfigAtPath(configStatus.content, keys);
    configStatus = configStatus.parent;
  } while ((ret === undefined) && (configStatus !== undefined));
  return ret;
}

function getToolsetPackageConfig (toolset) {
  try {
    return require(this.path.join(toolset, "package"));
  } catch (error) {
    return undefined;
  }
}

function _getConfigAtPath (root, keys) {
  return [].concat(...keys)
      .filter(key => (key !== undefined))
      .reduce((result, key) => ((result && (typeof result === "object")) ? result[key] : undefined),
          root);
}

function updatePackageConfig (updatesOrPath, maybeUpdates, maybeOptions) {
  if (!_vlm._packageConfigStatus.content) {
    throw new Error("vlm.updatePackageConfig: cannot update package.json as it doesn't exist");
  }
  return _updateConfig(_vlm, _vlm._packageConfigStatus, updatesOrPath, maybeUpdates, maybeOptions);
}

function updateToolsetsConfig (updatesOrPath, maybeUpdates, maybeOptions) {
  if (!_vlm._toolsetsConfigStatus.content) {
    _vlm._toolsetsConfigStatus.content = {};
    _vlm._toolsetsConfigStatus.updated = true;
  }
  return _updateConfig(_vlm, _vlm._toolsetsConfigStatus, updatesOrPath, maybeUpdates, maybeOptions);
}

function updateFileConfig (filename, updatesOrPath, maybeUpdates, maybeOptions = { flush: true }) {
  if (!Array.isArray(updatesOrPath)) {
    return updateFileConfig.call(this, filename, [], updatesOrPath, maybeUpdates);
  }
  const fileConfigStatus = { filename, path: this.path.join(process.cwd(), filename) };
  _reloadFileConfig(fileConfigStatus);
  const updatedConfig = _updateConfig(
      this, fileConfigStatus, updatesOrPath, maybeUpdates, maybeOptions);
  return updatedConfig;
}

function _updateConfig (vlm, configStatus, updatesOrPath, maybeUpdates, options) {
  if (!Array.isArray(updatesOrPath)) {
    return _updateConfig(vlm, configStatus, [], updatesOrPath, maybeUpdates);
  }
  const updates = updatesOrPath.reduceRight(
      (innerUpdates, pathKey) => ({ [pathKey]: innerUpdates }), maybeUpdates);
  // TODO(iridian): Implement locally pending config writes. See _flushPendingConfigWrites
  if (typeof updates !== "object" || !updates) {
    throw new Error(`Invalid arguments for config update: expexted object, got ${typeof update}`);
  }
  const updatedConfig = __deepAssign(configStatus.content, updates);
  if (updatedConfig !== configStatus.content) {
    configStatus.updated = true;
    configStatus.content = updatedConfig;
    vlm.ifVerbose(1)
        .info(`config file updated:`, configStatus.path);
  }
  if ((options || {}).flush) {
    _commitUpdates(vlm, configStatus);
  }
  return updatedConfig;
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

function findToolsetConfig (toolsetName, ...rest) {
  if (typeof toolsetName !== "string" || !toolsetName) {
    throw new Error(`Invalid arguments for findToolsetConfig, expexted string|..., got ${
        typeof toolsetName}`);
  }
  return this.findToolsetsConfig(toolsetName, ...rest);
}

function findToolConfig (toolsetName, toolName, ...rest) {
  if (typeof toolsetName !== "string" || typeof toolName !== "string"
      || !toolsetName || !toolName) {
    throw new Error(`Invalid arguments for findToolConfig, expexted string|string|..., got ${
        typeof toolsetName}|${typeof toolName}`);
  }
  return this.findToolsetsConfig(toolsetName, "tools", toolName, ...rest);
}

function confirmToolsetExists (toolsetName) {
  if (this.getToolsetConfig(toolsetName)) return true;
  this.warn(`Cannot find toolset '${toolsetName}' from configured toolsets:`,
      Object.keys(this.getToolsetsConfig() || {}).join(", "));
  return false;
}

function updateToolsetConfig (toolsetName, updates, options) {
  if (typeof toolsetName !== "string" || typeof updates !== "object" || !toolsetName || !updates) {
    throw new Error(`Invalid arguments for updateToolsetConfig, expexted string|object, got ${
        typeof toolsetName}|${typeof updates}`);
  }
  const updated = this.updateToolsetsConfig([toolsetName], updates, options);
  return updated[toolsetName];
}

function updateToolConfig (toolsetName, toolName, updates, options) {
  if (typeof toolsetName !== "string" || typeof toolName !== "string" || typeof updates !== "object"
      || !toolsetName || !toolName || !updates) {
    throw new Error(`Invalid arguments for updateToolConfig, expexted string|string|object, got ${
        typeof toolsetName}|${typeof toolName}|${typeof updates}`);
  }
  const updated = this.updateToolsetsConfig([toolsetName, "tools", toolName], updates, options);
  return updated[toolsetName].tools[toolName];
}

function domainVersionTag (domain) {
  const packageJSON = require(`${domain}/package`);
  const [, prerelease] = packageJSON.version.match(/[0-9]*\.[0-9]*\.[0-9]*(-*)?/);
  return prerelease
      ? `>=${packageJSON.version}`
      : `^{packageJSON.version}`;
}


/**
 * Adds new dev dependencies to current workspace.
 *
 * Takes an object with package names as keys and either an explicit
 * version string, release tag or 'true' (accepting any version) as
 * value.
 *
 * If a package matching requested version already exists in either
 * normal or dev dependency section no further action is made.
 *
 * If no existing package was found and the requested version is 'true'
 * then the prefix map this.defaultTags is searched for an entry with
 * the longest key that is a prefix of the package name. The value of
 * the entry is then used as the version tag in place of 'true'.
 *
 * @param {*} candidateDevDependencies
 * @param {*} [defaultTags=this.defaultTags]
 * @returns
 */
function addNewDevDependencies (candidateDevDependencies, defaultTags = this.defaultTags) {
  const { valos, dependencies, devDependencies } = this.getPackageConfig();
  let candidates = candidateDevDependencies;
  if (typeof candidates === "string") candidates = candidates.split(" ");
  if (Array.isArray(candidates)) {
    candidates = candidates.reduce((a, e) => {
      const [, name,, version] = e.match(/^(@?[^@]+)(@([^@]+))?$/);
      a[name] = version || true;
      return a;
    }, {});
  }
  const newDevDependencies = Object.entries(candidateDevDependencies)
      .filter(([name, newVersion]) => {
        if (!newVersion) return false;
        const currentVersion = (dependencies || {})[name] || (devDependencies || {})[name];
        if (!currentVersion) return true;
        if (newVersion === true) return false;
        return newVersion !== currentVersion;
      })
      .map(([name, newVersion]) => {
        let finalTag = newVersion;
        if (newVersion === true) {
          const longestPrefixMatch = Object.entries(defaultTags || {})
              .filter(([prefixCandidate]) => name.startsWith(prefixCandidate))
              .sort((a, b) => (b[0].length - a[0].length))[0];
          finalTag = longestPrefixMatch ? longestPrefixMatch[1] : "";
        }
        return !finalTag ? name : `${name}@${finalTag}`;
      });
  if (!newDevDependencies.length) return undefined;
  return thenChainEagerly(
      this.interact(
          [`yarn add --dev${valos.type === "vault" ? [" -W"] : ""}`, ...newDevDependencies]),
      () => newDevDependencies);
}


function __deepFreeze (object) {
  if (typeof object !== "object" || !object) return;
  Object.freeze(object);
  Object.values(object).forEach(__deepFreeze);
}

function __deepAssign (target, source) {
  if (source === undefined) return target;
  if (Array.isArray(target) && (source !== null)) return target.concat(source);
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
  _commitUpdates(this, _vlm._toolsetsConfigStatus);
  _commitUpdates(this, _vlm._packageConfigStatus);
}

function _commitUpdates (vlm, configStatus) {
  // TODO(iridian): Implement locally pending config writes. See _flushPendingConfigWrites
  if (!configStatus.updated) return;
  if (_vlm.vargv && _vlm.vargv["dry-run"]) {
    vlm.info(`commit '${configStatus.path}' updates --dry-run:`,
        "not committing queued updates to file");
    return;
  }
  const configString = JSON.stringify(
      configStatus.createUpdatedContent
          ? configStatus.createUpdatedContent(configStatus.content)
          : configStatus.content,
      null, 2);
  if (!vlm.shell.test("-f", configStatus.path)) {
    vlm.shell.mkdir("-p", vlm.path.dirname(configStatus.path));
  }
  shell.ShellString(`${configString}\n`).to(configStatus.path);
  vlm.ifVerbose(1)
      .info(`committed '${configStatus.path}' updates to file:`);
  configStatus.updated = false;
}

function __createVargs (args, cwd = process.cwd()) {
  // Get a proper, clean yargs instance for neat extending.
  const ret = yargs(args, cwd, require);
  ret.parserConfiguration({
    "short-option-groups": true,
    "camel-case-expansion": false,
    "dot-notation": true,
    "parse-numbers": true,
    "boolean-negation": true,
    "deep-merge-config": false
  });
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
    const toolset = subVLM && (subVLM.toolset || (_vlm._packageConfigStatus.content || {}).name);
    if (toolset) {
      const subPath = ["commands", subVLM.contextCommand, "options", opt];
      let default_ = subVLM.tool && subVLM.getToolConfig(toolset, subVLM.tool, ...subPath);
      if (default_ === undefined) default_ = subVLM.getToolsetConfig(toolset, ...subPath);
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
    let allConsequences = [];
    for (const cause of Object.keys(options.causes || {})) {
      allConsequences = allConsequences.concat(_consequences(vargv[cause], options.causes[cause]));
    }
    function _consequences (reason, causes) {
      if (!reason) return [];
      if (typeof causes === "string") return [`--${causes}`];
      if (Array.isArray(causes)) {
        return [].concat(...causes.map(cause => _consequences(reason, cause)));
      }
      return [];
    }
    if (allConsequences.length) {
      const { argv } = yargsParser(allConsequences, { ...options });
      for (const effect of Object.keys(argv)) {
        const defaultValue = options.default[effect];
        if ((effect !== "_")
            && (argv[effect] !== vargv[effect])
            && (argv[effect] !== defaultValue)
            && ((argv[effect] !== undefined) || (defaultValue !== undefined))) {
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

/*
#    #    ##       #    #    #
##  ##   #  #      #    ##   #
# ## #  #    #     #    # #  #
#    #  ######     #    #  # #
#    #  #    #     #    #   ##
#    #  #    #     #    #    #
*/

const _nodeKeepaliveInterval = setInterval(() => {
  _vlm.ifVerbose(1).clock("valma", "valma.keepalive", {});
}, 10000);

thenChainEagerly(_vlm.vargv, [
      vargv => module.exports.handler(vargv),
      result => {
        clearInterval(_nodeKeepaliveInterval);
        if (result !== undefined) {
          _vlm.result(result);
          process.exit(0);
        }
      },
    ],
    error => {
      clearInterval(_nodeKeepaliveInterval);
      if (error !== undefined) {
        _vlm.exception(
            ((error == null) || !(error instanceof Error))
                ? error
                : wrapError(error, 0,
                    new Error(`During $ ${_vlm.theme.vlmCommand("vlm", ...rootArgv)}`)),
            "vlm root");
      }
      process.exit(typeof error === "number" ? error : ((error && error.code) || -1));
    });
