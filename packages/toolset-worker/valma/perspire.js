#!/usr/bin/env vlm

exports.vlm = { toolset: "@valos/toolset-worker" };
exports.command = "perspire [revelationPath] [additionalRevelationPaths..]";
exports.describe = "Launch a headless worker for performing virtual DOM ValOS computation";
exports.introduction = `${exports.describe}.

.`;

exports.disabled = (yargs) => !yargs.vlm.packageConfig && "No package.json found";
exports.builder = (yargs) => yargs.option({
  output: {
    type: "string",
    default: "",
    description: "Path of a file to which the view root is rendered as a HTML DOM string",
  },
  keepalive: {
    default: false,
    description: `Keeps server alive after initial run. If keepalive is a positive number then ${
        ""}the possible output will be rendered and execute script run every 'keepalive' seconds. ${
        ""}If keepalive is negative the output/run cycle is run once after abs(keepalive) seconds.`,
  },
  stopClockEvent: {
    type: "string",
    description: `The clock event name which stops the worker on next tick`,
  },
  partitions: {
    type: "object",
    description: `A lookup of partition URI's to load before execution.${
        ""}\nThe partitions are loaded after revelation partitions but before view is attached.${
        ""}\nValaa.perspire.partitions contains these partitions connected this way as well as the${
        ""} "root" and "view" revelation partitions.`
  },
  exec: {
    type: "object", default: null,
    description: `Execute ValaaScript.\n\texec.body = direct VS content to execute. ${
        ""}\n\texec.path = path to a VS file to execute.\n\texec.this = the name of the ${
        ""}resource that is used as 'this' of the VS body; a URI specifies a Resource directly, ${
        ""}otherwise it is used to look up a partition connection root resource.\n\tAll the ${
        ""}options are available for the script via Valaa.perspire.options object with possible ${
        ""}expansions.`
  },
  plugin: {
    type: "string", array: true, default: [],
    description: `List of plugin id's which are require'd before gateway creation.`,
  },
  cacheBasePath: {
    type: "string",
    default: "dist/perspire/cache/",
    description: "Cache base path for indexeddb sqlite shim and other cache storages",
  },
  revelation: {
    description: "Direct revelation object placed after other revelations for gateway init.",
  },
  root: {
    type: "string", alias: "revelation.prologue.rootPartitionURI",
    description: `prologue root partition URI override`,
  },
  view: {
    type: "string", alias: "revelation.prologue.rootLensURI",
    description: `prologue root lens URI override`,
  },
  siteRoot: {
    type: "string", default: process.cwd(),
    description: `Explicit gateway.options.siteRoot path`,
  },
  domainRoot: {
    type: "string",
    description: `Explicit gateway.options.domainRoot path (defaults to siteRoot)`,
  },
  revelationRoot: {
    type: "string",
    description: `Explicit gateway.options.revelationRoot path ${
        ""}(by default path.dirname(revelationPath))`,
  },
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  // revelationPaths parsing
  global.window = global;
  const state = {
    "...": { chapters: true },
    tick: -1,
  };
  if (vlm.clockEvents) {
    state.clockEvents = { "...": {
      columns: [
        { context: { text: "context", style: "info" } },
        { event: { text: "event name", style: "info" } },
        { start: { text: "start time", style: "info" } },
        { duration: { text: "duration", style: "info" } },
        { message: { text: "event message", style: "info" } },
      ],
      entries: vlm.clockEvents,
    } };
  }
  vlm.clock("perspire.handler", "gateway.require", `require("@valos/inspire/PerspireServer")`);
  const PerspireServer = require("@valos/inspire/PerspireServer").default;

  const siteRoot = yargv.siteRoot[0] === "/" ? yargv.siteRoot
      : vlm.path.join(process.cwd(), yargv.siteRoot || ".");
  const domainRoot = !yargv.domainRoot ? siteRoot
      : yargv.domainRoot[0] === "/" ? yargv.domainRoot[0]
      : vlm.path.join(process.cwd(), yargv.domainRoot);

  let revelationPath = vlm.path.join(siteRoot, yargv.revelationPath || ".");
  if (!vlm.shell.test("-f", revelationPath)
      && !(yargv.revelationPath || "").match(/\/revela.json$/)) {
    revelationPath = vlm.path.join(revelationPath, "revela.json");
  }

  if (!vlm.shell.test("-f", revelationPath)) {
    throw new Error(`Cannot open initial revelation "${revelationPath}" for reading`);
  }

  let revelationRoot = yargv.revelationRoot;
  if (revelationRoot === undefined) {
    revelationRoot = vlm.path.dirname(revelationPath);
    revelationPath = vlm.path.basename(revelationPath);
  } else {
    revelationPath = vlm.path.resolve(revelationPath);
  }

  const execBody = yargv.exec && (yargv.exec.body || await vlm.readFile(yargv.exec.path, "utf8"));
  if (yargv.exec && (typeof execBody !== "string")) {
    console.error("Invalid execBody:", execBody);
    throw new Error(`Invalid exec body, expected a string, got: '${typeof execBody}' for path "${
        yargv.exec.path}"`);
  }

  vlm.shell.mkdir("-p", yargv.cacheBasePath);

  vlm.clock("perspire.handler", "gateway.create", "server = new PerspireServer");
  const server = new PerspireServer({
    logger: vlm,
    plugins: yargv.plugin,
    cacheBasePath: yargv.cacheBasePath,
    siteRoot,
    domainRoot,
    revelationRoot,
    revelations: [
      { "...": revelationPath },
      ...(yargv.additionalRevelationPaths || []).map(p => {
        const absolutePath = vlm.path.resolve(p);
        if (!vlm.shell.test("-f", absolutePath)) {
          throw new Error(`Cannot open additional revelation path "${absolutePath}" for reading`);
        }
        return { "...": absolutePath };
      }),
      { gateway: { verbosity: vlm.verbosity } },
      yargv.revelation || {},
    ],
  });

  vlm.clock("perspire.handler", "gateway.initialize", "server.initialize()");
  await server.initialize();

  vlm.clock("perspire.handler", "perspire.partitions",
      "gateway.acquirePartitionConnections(yargv.partitions)");
  const partitions = { root: server.gateway.rootPartition };
  for (const [key, partitionURI] of Object.entries(yargv.partitions || {})) {
    partitions[key] = await server.gateway.falseProphet
        .acquirePartitionConnection(partitionURI, { newPartition: false })
        .getActiveConnection();
  }
  vlm.clock("perspire.handler", "gateway.mainView", "server.createMainView");
  const mainView = await server.createMainView();
  partitions.view = mainView.getViewPartition();

  mainView.rootScope.Valaa.Perspire.options = yargv;
  mainView.rootScope.Valaa.Perspire.state = state;

  let vExecThis;
  if (yargv.exec) {
    const vThisConnection = partitions[yargv.exec.this || "view"];
    // TODO(iridian, 2019-02): Add support for URI form exec.this
    vExecThis = mainView.engine.getVrapperByRawId(vThisConnection.getPartitionRawId());
  }

  const keepaliveInterval = (typeof yargv.keepalive === "number")
      ? yargv.keepalive : (yargv.keepalive && 1);
  let ret;
  if (!keepaliveInterval) {
    vlm.clock("perspire.handler", "perspire.immediate", "falsy keepalive interval");
    vlm.info("No keepalive enabled");
    state.mode = "immediate rendering";
    ret = await _tick("immediate", 0);
  } else {
    vlm.info(`Setting up keepalive render every ${keepaliveInterval} seconds`);
    state.mode = keepaliveInterval >= 0 ? "keepalive rendering" : "delayed single shot rendering";
    vlm.clock("perspire.handler", "perspire.delay", `server.run(${keepaliveInterval})`);
    let nextUncheckedEvent = 0;
    ret = await server.run(Math.abs(keepaliveInterval), (tickIndex) => {
      const tickRet = _tick(`heartbeat ${tickIndex}:`, tickIndex);
      const stopEntrySearch = yargv.stopClockEvent && vlm.clockEvents;
      if (stopEntrySearch) {
        while (nextUncheckedEvent < stopEntrySearch.length) {
          if (stopEntrySearch[nextUncheckedEvent++].event === yargv.stopClockEvent) return tickRet;
        }
      }
      if (keepaliveInterval >= 0) return undefined;
      return tickRet;
    });
  }
  vlm.finalizeClock();
  return ret;

  function _tick (header, tick) {
    vlm.clock("perspire.handler", `server.tick(${tick}).dom`,
        `${header} serialize/write DOM`);
    state.domString = server.serializeMainDOM();
    state.tick = tick;
    _writeDomString(state.domString, header);
    if (vExecThis && execBody) {
      const sourceInfo = {
        phase: "perspire.exec transpilation",
        source: execBody,
        mediaName: yargv.exec.path || "exec.body",
        sourceMap: new Map(),
      };
      vlm.clock("perspire.handler", `server.tick(${tick}).exec`,
          `${header} transpile and execute valaascript`);
      const execResult = vExecThis && execBody && vExecThis.doValaaScript(execBody, { sourceInfo });
      if (execResult !== undefined) return execResult;
    }
    return state;
  }

  function _writeDomString (domString, header) {
    if (yargv.output) {
      vlm.shell.ShellString(domString).to(yargv.output);
      vlm
      .ifVerbose(1).babble(header, `wrote ${domString.length} dom string chars to "${
          yargv.output}"`)
      .ifVerbose(2).expound("\tdom string:\n", domString);
    } else {
      vlm
      .ifVerbose(1).babble(header, `discarded ${domString.length} dom string chars`)
      .ifVerbose(2).expound("\tdom string:\n", domString);
    }
  }
};
