#!/usr/bin/env vlm
exports.vlm = { toolset: "@valos/type-worker" };
exports.command = "perspire [revelationPath] [additionalRevelationPaths..]";
exports.describe = "Launch a headless worker gateway for persistent virtual DOM ValOS computation";
exports.introduction = ``;

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
  heartbeat: {
    type: "string",
    default: true,
    description: `Outputs a heartbeat message everytime the keepalive heartbeat is emitted.`,
  },
  stopClockEvent: {
    type: "string",
    description: `The clock event name which stops the worker on next tick`,
  },
  partitions: {
    type: "object",
    description: `A lookup of partition URI's to load before execution.${
        ""}\nThe partitions are loaded after revelation partitions but before view is attached.${
        ""}\nvalos.perspire.partitions contains these partitions connected this way as well as the${
        ""} "root" and "view" revelation partitions.`
  },
  exec: {
    type: "object", default: null,
    description: `Execute valoscript.\n\texec.body = direct VS content to execute. ${
        ""}\n\texec.path = path to a VS file to execute.\n\texec.this = the name of the ${
        ""}resource that is used as 'this' of the VS body; a URI specifies a Resource directly, ${
        ""}otherwise it is used to look up a partition connection root resource.\n\tAll the ${
        ""}options are available for the script via valos.perspire.options object with possible ${
        ""}expansions.`
  },
  interactive: {
    type: "boolean", default: true,
    description: `Enable interactive console. Console input is interpreted as valoscript and ${
        ""} executed using the exec.this as 'this' (or view if exec is not specified)`,
  },
  "spindle-ids": {
    type: "string", array: true, default: [],
    description: `List of spindle id's which are require'd before gateway creation.`,
  },
  cacheBasePath: {
    type: "string",
    default: "dist/perspire/cache/",
    description: "Cache base path for indexeddb sqlite shim and other cache storages",
  },
  revelation: {
    type: "object",
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
  const { wrapError } = require("@valos/tools");

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

  const execBody = yargv.exec
      && (yargv.exec.body || (yargv.exec.path && await vlm.readFile(yargv.exec.path)));
  if (yargv.exec && (typeof execBody !== "string")) {
    console.error("Invalid execBody:", execBody);
    throw new Error(`Invalid exec body, expected a string, got: '${typeof execBody}' for path "${
        yargv.exec.path}"`);
  }

  vlm.shell.mkdir("-p", yargv.cacheBasePath);
  if ((revelationPath[0] !== "/") && (revelationPath[0] !== ".")) {
    revelationPath = `./${revelationPath}`;
  }

  vlm.clock("perspire.handler", "gateway.create", "server = new PerspireServer");
  const server = new PerspireServer({
    logger: vlm,
    spindleIds: yargv["spindle-ids"],
    cacheBasePath: yargv.cacheBasePath,
    siteRoot,
    domainRoot,
    revelationRoot,
    revelations: [
      { "!!!": revelationPath },
      ...(yargv.additionalRevelationPaths || []).map(maybeRelativePath => {
        const absolutePath = vlm.path.resolve(maybeRelativePath);
        if (!vlm.shell.test("-f", absolutePath)) {
          throw new Error(`Cannot open additional revelation path "${absolutePath}" for reading`);
        }
        return { "!!!": maybeRelativePath };
      }),
      { gateway: { verbosity: vlm.verbosity } },
      yargv.revelation || {},
    ],
  });

  vlm.clock("perspire.handler", "gateway.initialize", "server.initialize()");
  await server.initialize();

  vlm.clock("perspire.handler", "perspire.partitions",
      "gateway.acquireConnections(yargv.partitions)");
  const partitions = { root: server.gateway.rootPartition };
  for (const [key, partitionURI] of Object.entries(yargv.partitions || {})) {
    // Note: direct falseProphet.acquire (without discourse) doesn't
    // have identity manager.
    partitions[key] = await server.gateway.falseProphet
        .acquireConnection(partitionURI, { newPartition: false })
        .asActiveConnection();
  }
  vlm.clock("perspire.handler", "gateway.mainView", "server.createMainView");
  const mainView = await server.createMainView();
  mainView.rootScope.valos.view = partitions.view = mainView.getViewPartition();

  mainView.rootScope.valos.Perspire.options = yargv;
  mainView.rootScope.valos.Perspire.state = state;
  const mainViewName = `worker.view.${mainView.getRawName()}`;

  let vExecThis, mutableScope;
  if (yargv.exec || yargv.interactive) {
    const vThisConnection = partitions[(yargv.exec || {}).this || "view"];
    // TODO(iridian, 2019-02): Add support for URI form exec.this
    vExecThis = mainView.engine.getVrapperByRawId(vThisConnection.getPartitionRawId());
    mutableScope = Object.create(vExecThis.getLexicalScope());
  }

  if (yargv.interactive) {
    const readline = require("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.on("line", (command) => {
      if (!command) return;
      vlm.clock(mainViewName, `worker.interactive.command`, {
        action: `executing interactive command`, command,
      });
      const sourceInfo = {
        phase: "interactive command transpilation",
        source: command,
        mediaName: "worker.interactive.command",
        sourceMap: new Map(),
      };
      try {
        vlm.clock(mainViewName, `worker.interactive.result`, {
          action: "executed interactive command", command,
          result: vExecThis && vExecThis.doValoscript(command, {}, { sourceInfo, mutableScope }),
        });
      } catch (error) {
        vlm.clock(mainViewName, `worker.interactive.error`, {
          action: "caught exception during interactive command", command,
          message: error.message, error,
        });
      }
    }).on("close", () => {
      vlm.info("Closing perspire interactive");
      process.exit(0);
    });
  }

  const keepaliveInterval = (typeof yargv.keepalive === "number")
      ? yargv.keepalive : (yargv.keepalive && 1);
  let ret;
  if (!keepaliveInterval) {
    vlm.clock(mainViewName, "perspire.immediate", "falsy keepalive interval");
    vlm.info("No keepalive enabled");
    state.mode = "immediate rendering";
    ret = await _tick({ info: "immediate" }, 0);
  } else {
    vlm.info(`Setting up keepalive render every ${keepaliveInterval} seconds`);
    state.mode = keepaliveInterval >= 0 ? "keepalive rendering" : "delayed single shot rendering";
    vlm.clock(mainViewName, "perspire.delay", `server.run(${keepaliveInterval})`);
    let nextUncheckedEvent = 0;
    ret = await server.run(Math.abs(keepaliveInterval), (tickIndex) => {
      const tickRet = _tick(
          typeof yargv.heartbeat === "string" ? { info: yargv.heartbeat }
              : yargv.heartbeat ? {} : undefined,
          tickIndex);
      const stopEntrySearch = yargv.stopClockEvent && vlm.clockEvents;
      if (stopEntrySearch) {
        while (nextUncheckedEvent < stopEntrySearch.length) {
          if (stopEntrySearch[nextUncheckedEvent++].event === yargv.stopClockEvent) return tickRet;
        }
      }
      if (keepaliveInterval >= 0) return undefined;
      return tickRet;
    }, { tickOnceImmediately: keepaliveInterval >= 0 });
  }
  vlm.finalizeClock();
  return ret;

  function _tick (heartbeatClockFields, tick) {
    const status = { tick, ...heartbeatClockFields };
    if (server.gateway.getTotalCommandCount()) {
      status.commandCount = server.gateway.getTotalCommandCount();
      status.partitions = server.gateway.getPartitionStatuses();
    }
    if (heartbeatClockFields) {
      status.action = `serializing DOM`;
      vlm.clock(mainViewName, `worker.heartbeat.dom`, status);
    }
    state.domString = server.serializeMainDOM();
    state.tick = tick;
    state.timeStamp = Date.now();
    _writeDomString(state.domString,
        heartbeatClockFields ? JSON.stringify(heartbeatClockFields) : "<no heartbeat fields>");
    if (vExecThis && execBody) {
      const sourceInfo = {
        phase: "perspire.exec transpilation",
        source: execBody,
        mediaName: yargv.exec.path || "exec.body",
        sourceMap: new Map(),
      };
      if (heartbeatClockFields) {
        status.action = `executing '${sourceInfo.mediaName}'`;
        vlm.clock(mainViewName, `worker.heartbeat.exec`, status);
      }
      try {
        const execResult = vExecThis && execBody
            && vExecThis.doValoscript(execBody, {}, { sourceInfo });
        if (execResult !== undefined) return execResult;
      } catch (error) {
        status.action = `caught exception: ${error.message}`;
        status.message = error.message;
        status.error = error;
        vlm.clock(mainViewName, `worker.heartbeat.exec.error`, status);
        server.gateway.outputErrorEvent(
            wrapError(error, new Error("During perspire.tick.doValoscript"),
                "\n\texec.body:\n```", execBody, "\n```\n"),
            "Exception caught during worker.tick");
      }
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
