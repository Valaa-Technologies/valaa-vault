#!/usr/bin/env vlm
exports.vlm = { toolset: "@valos/type-worker" };
exports.command = "perspire [revelationPath] [additionalRevelationPaths..]";
exports.describe = "Launch a headless worker gateway for virtual DOM ValOS computation jobs";
exports.introduction = ``;

exports.disabled = (yargs) => !yargs.vlm.packageConfig && "No package.json found";
exports.builder = (yargs) => yargs.option({
  spindles: {
    group: "Gateway options:",
    type: "string", array: true, default: [],
    description: `List of spindles to require before gateway creation`,
  },
  "cache-base": {
    group: "Gateway options:",
    type: "string",
    default: "dist/perspire/cache/",
    description: "Cache base path for indexeddb sqlite shim and other cache storages",
  },
  revelation: {
    group: "Gateway options:",
    type: "object",
    description: "Direct revelation object placed after other revelations for gateway init",
  },
  root: {
    group: "Gateway options:",
    type: "string", alias: "revelation.prologue.rootChronicleURI",
    description: `prologue root chronicle URI override`,
  },
  siteRoot: {
    group: "Gateway options:",
    type: "string", default: process.cwd(),
    description: `Explicit gateway.options.siteRoot path`,
  },
  domainRoot: {
    group: "Gateway options:",
    type: "string",
    description: `Explicit gateway.options.domainRoot path (defaults to siteRoot)`,
  },
  revelationRoot: {
    group: "Gateway options:",
    type: "string",
    description: `Explicit gateway.options.revelationRoot path ${
        ""}(by default path.dirname(revelationPath))`,
  },
  chronicles: {
    group: "Job options:",
    type: "object",
    description: `A lookup of chronicle URI's to load before the job view is attached.${
        ""}\nThe chronicles are loaded after revelation chronicles but before view is attached.${
        ""}\nvalos.perspire.chronicles contains these chronicles connected this way as well as the${
        ""} "root" and "view" revelation chronicles.`
  },
  view: {
    group: "Job options:",
    type: "object", default: null,
    description: `job view configuration object (see Gateway.addView). Notably:
\tview.name: lookup key to revelation views
\tview.focus: the view focus valos URI`
  },
  keepalive: {
    group: "Job options:",
    default: false,
    description: `Keeps worker alive after initial run.
\tIf keepalive is a positive number it is a repeated interval (in seconds) after which the job ${
  ""} (if any) is ran and the view outputs are rendered to a file.
\tIf keepalive is negative the execute/output cycle is run once after abs(keepalive) seconds.`,
  },
  output: {
    group: "Job options:",
    type: "string",
    default: "",
    description: "A HTML DOM string file to which the views are rendered at each keepalive tick",
  },
  heartbeat: {
    group: "Job options:",
    type: "string",
    default: true,
    description: `A heartbeat message to log to vlm console at each keepalive tick`,
  },
  "stop-clock-event": {
    group: "Job options:",
    type: "string",
    description: `The clock event name which stops the worker on next keepalive tick`,
  },
  "run-body": {
    group: "Job options:",
    type: "string",
    description: `Embedded job valoscript body to run at each keepalive tick`,
  },
  "run-path": {
    group: "Job options:",
    type: "string",
    description: `Path to a job valoscript file to run at each keepalive tick`,
  },
  exec: {
    group: "Job options:",
    type: "object", default: null,
    description: `DEPRECATED. Execute valoscript.
\texec.body: DEPRECATED in favor of --job-body. direct job valoscript body to execute.
\texec.path: DEPRECATED in favor of --job-path. path to a job valoscript file to execute.
\texec.this: DEPRECATED in favor of --view.focus. the name of the resource that is used as 'this'${
  ""} of the VS body.
\tAll the options are available for the script via valos.perspire.options object with possible ${
  ""}expansions.`
  },
  interactive: {
    group: "Job options:",
    type: "boolean", default: true,
    description: `Enable interactive console. Console input is interpreted as valoscript and ${
        ""} executed using the view focus as 'this'`,
  },
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  // revelationPaths parsing
  global.window = global;

  const jobState = {
    "...": { chapters: true },
    tick: -1,
    jobBody: yargv["run-body"]
        || (yargv["run-path"] && await vlm.readFile(yargv["run-path"]))
        || (yargv.exec
            && (yargv.exec.body || (yargv.exec.path && await vlm.readFile(yargv.exec.path)))),
  };

  if ((jobState.jobBody != null) && (typeof jobState.jobBody !== "string")) {
    console.error("Invalid job body:", jobState.jobBody);
    throw new Error(`Invalid job body, expected a string, got: '${
        typeof jobState.jobBody}' for path "${yargv.exec.path}"`);
  }

  if (vlm.clockEvents) {
    jobState.clockEvents = { "...": {
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
  const worker = await _obtainWorker(vlm, yargv);
  const vThis = await _createJobView(vlm, yargv, jobState, worker);
  const job = _runJob(vlm, yargv, jobState, worker, vThis);
  const interactive = yargv.interactive && _runInteractive(vlm, yargv, jobState, vThis);
  let jobResult, jobError;
  try {
    return (jobResult = await job);
  } catch (error) {
    throw (jobError = error);
  } finally {
    if ((interactive || {}).close) interactive.close(jobResult, jobError);
  }
};

let _workerSingleton;

async function _obtainWorker (vlm, yargv) {
  if (yargv.attach) {
    if (!_workerSingleton) {
      throw new Error("No initialized perspire worker to attach to found within process");
    }
    if (yargv.siteRoot) throw new Error("Can't have --siteRoot with --attach");
    if (yargv.domainRoot) throw new Error("Can't have --domainRoot with --attach");
    if (yargv.revelationPath) throw new Error("Can't have --revelationPath with --attach");
    if (yargv["cache-base"]) throw new Error("Can't have --cache-base with --attach");
    if (yargv.spindles) throw new Error("Can't have --spindles with --attach");
    if (yargv.additionalRevelationPaths) {
      throw new Error("Can't have --additionalRevelationPaths with --attach");
    }
    if (yargv.revelation) throw new Error("Can't have --revelation with --attach");
    return _workerSingleton;
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

  if (_workerSingleton !== undefined) {
    throw new Error("This process is already running a perspire worker, see --attach");
  }
  _workerSingleton = null; // initializing

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

  vlm.shell.mkdir("-p", yargv["cache-base"]);
  if ((revelationPath[0] !== "/") && (revelationPath[0] !== ".")) {
    revelationPath = `./${revelationPath}`;
  }

  vlm.clock("perspire.handler", "gateway.create", "worker = new PerspireServer");
  const worker = new PerspireServer({
    logger: vlm,
    spindles: yargv.spindles,
    cacheBasePath: yargv["cache-base"],
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

  vlm.clock("perspire.handler", "gateway.initialize", "worker.initialize()");
  await worker.initialize();

  return (_workerSingleton = worker);
}

async function _createJobView (vlm, yargv, jobState, worker) {
  vlm.clock("perspire.handler", "perspire.chronicles",
      "gateway.acquireConnections(yargv.chronicles)");
  const connections = { root: worker.gateway.getRootConnection() };
  const chronicleURIs = yargv.chronicles || {};
  const focus = (yargv.view || {}).focus || (yargv.exec || {}).this;
  if (focus) {
    chronicleURIs.view = focus;
  }
  for (const [key, chronicleURI] of Object.entries(chronicleURIs)) {
    connections[key] = await worker.gateway.discourse
        .acquireConnection(chronicleURI.split("#")[0], { newChronicle: false })
        .asActiveConnection();
  }

  let jobName = yargv.attach;
  if (jobName === true) jobName = `job-${vlm.getContextIndexText()}`;

  vlm.clock("perspire.handler", "gateway.view", !jobName
      ? "worker.createWorkerView()"
      : `worker.createJobView(${jobName})`);
  const view = await (!jobName
      ? worker.createWorkerView(yargv.view || {})
      : worker.createView(jobName, yargv.view || {}));
  jobState.viewName = `perspire.view.${view.getRawName()}`;
  view.rootScope.valos.view = connections.view = view.getFocus().getConnection();
  view.rootScope.valos.Perspire.options = yargv;
  view.rootScope.valos.Perspire.state = jobState;
  return view.getFocus();
}

async function _runJob (vlm, yargv, jobState, worker, vThis) {
  const keepaliveInterval = (typeof yargv.keepalive === "number")
      ? yargv.keepalive : (yargv.keepalive && 1);
  let ret;
  if (!keepaliveInterval) {
    vlm.clock(jobState.viewName, "perspire.immediate", "falsy keepalive interval");
    vlm.info("No keepalive enabled");
    jobState.mode = "immediate rendering";
    ret = await _tick(vlm, yargv, jobState, worker, vThis, { info: "immediate" }, 0);
  } else {
    vlm.info(`Setting up keepalive render every ${keepaliveInterval} seconds`);
    jobState.mode = `${keepaliveInterval >= 0 ? "keepalive" : "delayed single shot"} rendering`;
    vlm.clock(jobState.viewName, "perspire.delay", `worker.run(${keepaliveInterval})`);
    let nextUncheckedEvent = 0;
    ret = await worker.run(Math.abs(keepaliveInterval), async (tickIndex) => {
      const tickRet = await _tick(
          vlm, yargv, jobState, worker, vThis,
          typeof yargv.heartbeat === "string" ? { info: yargv.heartbeat }
              : yargv.heartbeat ? {} : undefined,
          tickIndex);
      const stopEntrySearch = yargv["stop-clock-event"] && vlm.clockEvents;
      if (stopEntrySearch) {
        while (nextUncheckedEvent < stopEntrySearch.length) {
          if (stopEntrySearch[nextUncheckedEvent++].event === yargv["stop-clock-event"]) {
            return tickRet;
          }
        }
      }
      if (keepaliveInterval >= 0) return undefined;
      return tickRet;
    }, { tickOnceImmediately: keepaliveInterval >= 0 });
  }
  vlm.finalizeClock();
  // TODO(iridian, 2020-02): Detach view and release resources.
  return ret;
}

async function _tick (vlm, yargv, jobState, worker, vThis, heartbeatClockFields, tick) {
  const status = { tick, ...heartbeatClockFields };
  if (worker.gateway.getTotalCommandCount()) {
    status.commandCount = worker.gateway.getTotalCommandCount();
    status.chronicles = worker.gateway.getChronicleStatuses();
  }
  if (heartbeatClockFields) {
    status.action = `serializing DOM`;
    vlm.clock(jobState.viewName, `worker.heartbeat.dom`, status);
  }
  jobState.domString = worker.serializeMainDOM();
  jobState.tick = tick;
  jobState.timeStamp = Date.now();
  _writeDomString(vlm, yargv, jobState.domString,
      heartbeatClockFields ? JSON.stringify(heartbeatClockFields) : "<no heartbeat fields>");
  if (!vThis || !jobState.jobBody) return jobState;

  const sourceInfo = {
    phase: "perspire.exec transpilation",
    source: jobState.jobBody,
    mediaName: yargv.exec.path || "job body",
    sourceMap: new Map(),
  };
  if (heartbeatClockFields) {
    status.action = `executing '${sourceInfo.mediaName}'`;
    vlm.clock(jobState.viewName, `worker.heartbeat.exec`, status);
  }
  try {
    const execResult = await vThis.doValoscript(jobState.jobBody, {}, { sourceInfo });
    if (execResult !== undefined) return execResult;
  } catch (error) {
    status.action = `caught exception: ${error.message}`;
    status.message = error.message;
    status.error = error;
    vlm.clock(jobState.viewName, `worker.heartbeat.exec.error`, status);
    const name = new Error("perspire.tick.doValoscript");
    worker.outputErrorEvent(
        worker.wrapErrorEvent(error, 1, () => [
          name,
          "\n\tjobBody:\n```", jobState.jobBody, "\n```\n",
        ]),
        "Exception caught during worker.tick");
  }
  return jobState;
}

function _writeDomString (vlm, yargv, domString, header) {
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

function _runInteractive (vlm, yargv, jobState, vThis) {
  if (!vThis) throw new Error("'exec.this' missing for interactive job");
  const mutableScope = Object.create(vThis.getLexicalScope());

  const readline = require("readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let externalExit = false;
  rl.on("line", async (command) => {
    if (!command) return;
    vlm.clock(jobState.viewName, `worker.interactive.command`, {
      action: `executing interactive command`, command,
    });
    const sourceInfo = {
      phase: "interactive command transpilation",
      source: command,
      mediaName: "worker.interactive.command",
      sourceMap: new Map(),
    };
    try {
      const result = await vThis.doValoscript(command, {}, { sourceInfo, mutableScope });
      vlm.clock(jobState.viewName, `worker.interactive.result`, {
        action: "executed interactive command", command, result,
      });
    } catch (error) {
      vlm.clock(jobState.viewName, `worker.interactive.error`, {
        action: "caught exception during interactive command", command,
        message: error.message, error,
      });
    }
  }).on("close", () => {
    vlm.info("Closing perspire job interactive:", externalExit || "end of stream");
    if (!externalExit) process.exit(0);
  });
  return {
    close (jobResult, jobError) {
      externalExit = jobError ? "job failed" : "job complete";
      rl.close();
    }
  };
}
