#!/usr/bin/env vlm
exports.vlm = { toolset: "@valos/type-worker" };
exports.command = "perspire [revelation-path] [additional-revelation-paths..]";
exports.describe = "Launch a headless worker gateway for virtual DOM ValOS computation jobs";
exports.introduction = ``;

exports.disabled = (yargs) => !yargs.vlm.packageConfig && "No package.json found";
exports.builder = (yargs) => yargs.option({
  spindles: {
    group: "Worker options:",
    type: "string", array: true, default: [],
    description: `List of spindles to require before gateway or job (with --attach) creation`,
  },
  attach: {
    group: "Worker options:",
    type: "boolean",
    description:
`Attach to an existing perspire worker running in the current process.
Invalidates all other worker options (except --spindles).`,
  },
  "cache-base": {
    group: "Worker options:",
    type: "string",
    default: "dist/perspire/cache/",
    description: "Cache base path for indexeddb sqlite shim and other cache storages",
  },
  revelation: {
    group: "Worker options:",
    type: "object",
    description: "Direct revelation object placed after other revelations for gateway init",
  },
  root: {
    group: "Worker options:",
    type: "string", alias: "revelation.prologue.rootChronicleURI",
    description: `prologue root chronicle URI override`,
  },
  "site-root": {
    group: "Worker options:",
    type: "string", default: process.cwd(),
    description: `Explicit gateway.options.siteRoot path`,
  },
  "domain-root": {
    group: "Worker options:",
    type: "string",
    description: `Explicit gateway.options.domainRoot path (defaults to siteRoot)`,
  },
  "revelation-root": {
    group: "Worker options:",
    type: "string",
    description: `Explicit gateway.options.revelationRoot path ${
        ""}(by default path.dirname(revelationPath))`,
  },
  "worker-html": {
    group: "Worker options:",
    type: "string",
    description: `Worker root view HTML output file path, rendered after each job update`,
  },
  chronicles: {
    group: "Job options:",
    type: "object",
    description: `A lookup of chronicle URI's to load before the job view is attached.${
        ""}\nThe chronicles are loaded after revelation chronicles but before view is attached.${
        ""}\nvalos.perspire.chronicles contains these chronicles connected this way as well as the${
        ""} "root" and "view" revelation chronicles.`
  },
  "job-name": {
    group: "Job options:",
    description: `Job name. If not given a name based on vlm context index is generated`,
  },
  "job-view": {
    group: "Job options:",
    type: "object", default: null,
    description: `job view configuration object (see Gateway.addView). Notably:
\tview.name: lookup key to revelation views
\tview.focus: the view focus valos URI`
  },
  delay: {
    group: "Job options:", type: "number", default: 0,
    description: `Delay (in seconds) until the initial job is executed.`,
  },
  repeats: {
    group: "Job options:",
    description: `Number of repeat runs for the job after initial run (infinite if truthy).`,
  },
  "stop-event": {
    group: "Job options:", type: "string",
    description: `Stop repeating the job after a clock event with this name is seen`,
  },
  interval: {
    group: "Job options:", type: "number", default: 60,
    description: `Delay (in seconds) between repeated jobs after initial run.`,
  },
  keepalive: {
    group: "Job options:",
    description: `DEPRECATED in favor of --delay, --repeats and --interval.
If positive or truthy corresponds to --repeats --interval=keepalive or --interval=1.
If negative or falsy corresponds to --no-repeats --delay=abs(keepalive || 0).`,
  },
  "job-html": {
    group: "Job options:",
    type: "string",
    description: "Job view HTML output file path, rendered after each job run",
  },
  heartbeat: {
    group: "Job options:",
    type: "string",
    default: true,
    description: `Enable vlm clock heartbeat. A string or object value is included in the event`,
  },
  "job-body": {
    group: "Job options:",
    type: "string",
    description: `Embedded valoscript body to run as the job`,
  },
  "job-path": {
    group: "Job options:",
    type: "string",
    description: `Path to a valoscript file to run as the job`,
  },
  "job-spindle": {
    group: "Job options:",
    type: "string",
    description: `Spindle name to run as the job.
The spindle .runJob is called with the view as first parameter.`,
  },
  interactive: {
    group: "Job options:",
    type: "boolean", default: true,
    description: `Enable interactive console. Console input is interpreted as a valoscript body ${
        ""} with the view focus as 'this'`,
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
});

exports.handler = (yargv) => {
  const vlm = yargv.vlm;
  // revelationPaths parsing
  global.window = global;
  const worker = _obtainWorker(vlm, yargv);
  return _performJob(vlm, yargv, worker);
};

/*
 #    #   ####   #####   #    #  ######  #####
 #    #  #    #  #    #  #   #   #       #    #
 #    #  #    #  #    #  ####    #####   #    #
 # ## #  #    #  #####   #  #    #       #####
 ##  ##  #    #  #   #   #   #   #       #   #
 #    #   ####   #    #  #    #  ######  #    #
*/

const { thenChainEagerly } = require("@valos/tools/thenChainEagerly");

let valosheath;

exports.getWorker = () => {
  if (!valosheath) valosheath = require("@valos/gateway-api/valos").default;
  return valosheath._workerSingleton;
};

function _obtainWorker (vlm, yargv) {
  if (!valosheath) valosheath = require("@valos/gateway-api/valos").default;
  const attach = yargv.attach;
  if (typeof attach === "string") {
    if (attach !== "require") {
      throw new Error("Invalid --attach value: only 'require' or boolean accepted");
    }
    if (!valosheath._workerSingleton) {
      throw new Error("No perspire worker to attach to found within process");
    }
  }
  if (valosheath._workerSingleton) {
    if (!attach) {
      throw new Error("This process is already running a perspire worker, see --attach");
    }
    if (attach !== true) {
      const existingWorkerOption = [
        "revelation-path", "additional-revelation-paths", "cache-base", "revelation", "root",
        "site-root", "domain-root", "revelation-root", "worker-html",
      ].find(workerOption => yargv[workerOption]);
      if (existingWorkerOption) {
        throw new Error(`Can't have worker option --${existingWorkerOption} with --attach`);
      }
    }
    vlm.clock("perspire.handler", "worker.spindles", `worker.requireSpindles()`);
    return thenChainEagerly(valosheath._workerSingleton, worker => {
      worker.requireSpindles(yargv.spindles || []);
      return worker;
    });
  }

  vlm.clock("perspire.handler", "worker.require", `require("@valos/inspire/PerspireServer")`);
  const PerspireServer = require("@valos/inspire/PerspireServer").default;

  const siteRoot = (yargv["site-root"] || "")[0] === "/" ? yargv["site-root"]
      : vlm.path.join(process.cwd(), yargv["site-root"] || ".");
  const domainRoot = !yargv["domain-root"] ? siteRoot
      : (yargv["domain-root"] || "")[0] === "/" ? yargv["domain-root"]
      : vlm.path.join(process.cwd(), yargv["domain-root"]);

  let revelationPath = vlm.path.join(siteRoot, yargv["revelation-path"] || ".");
  if (!vlm.shell.test("-f", revelationPath)
      && !(yargv["revelation-path"] || "").match(/\/revela.json$/)) {
    revelationPath = vlm.path.join(revelationPath, "revela.json");
  }

  if (!vlm.shell.test("-f", revelationPath)) {
    throw new Error(`Cannot open initial revelation "${revelationPath}" for reading`);
  }

  return (valosheath._workerSingleton = thenChainEagerly(null, [
    () => {
      let revelationRoot = yargv["revelation-root"];
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

      vlm.clock("perspire.handler", "worker.create", "worker = new PerspireServer");
      const worker = new PerspireServer({
        parent: vlm,
        cacheBasePath: yargv["cache-base"],
        siteRoot,
        domainRoot,
        revelationRoot,
        revelations: [
          { "!!!": revelationPath },
          ...(yargv["additional-revelation-paths"] || []).map(maybeRelativePath => {
            const absolutePath = vlm.path.resolve(maybeRelativePath);
            if (!vlm.shell.test("-f", absolutePath)) {
              throw new Error(
                  `Cannot open additional revelation path "${absolutePath}" for reading`);
            }
            return { "!!!": maybeRelativePath };
          }),
          { gateway: { verbosity: vlm.verbosity } },
          yargv.revelation || {},
        ],
      });

      vlm.clock("perspire.handler", "worker.initialize", "worker.initialize()");
      return worker;
    },
    worker => worker.initialize(yargv.spindles || []),
    worker => {
      if (yargv["worker-html"]) {
        worker.onHTMLUpdated(html => vlm.shell.ShellString(html).to(yargv["worker-html"]));
      }
      return worker;
    },
    worker => (valosheath._workerSingleton = worker),
  ]));
}

/*
      #   ####   #####
      #  #    #  #    #
      #  #    #  #####
      #  #    #  #    #
 #    #  #    #  #    #
  ####    ####   #####
*/

async function _performJob (vlm, yargv, worker_) {
  const worker = await worker_;
  const journal = {
    "...": { chapters: true },
    tick: -1,
    jobBody: yargv["job-body"]
        || (yargv["job-path"] && await vlm.readFile(yargv["job-path"]))
        || (yargv.exec
            && (yargv.exec.body || (yargv.exec.path && await vlm.readFile(yargv.exec.path)))),
    jobOrigin: yargv["job-body"] ? "--job-body"
        : yargv["job-path"] ? yargv["job-path"]
        : (yargv.exec || {}).body ? "--exec.body"
        : (yargv.exec || {}).path ? yargv.exec.path
        : undefined,
  };
  if (yargv["job-spindle"]) {
    if (journal.jobBody) {
      throw new Error("Only one of --job-body, --job-path or --job-spindle allowed");
    }
    journal.jobSpindleName = yargv["job-spindle"];
  }

  if ((journal.jobBody != null) && (typeof journal.jobBody !== "string")) {
    console.error("Invalid job body:", journal.jobBody);
    throw new Error(`Invalid job body, expected a string, got: '${
        typeof journal.jobBody}' for path "${yargv.exec.path}"`);
  }

  if (vlm.clockEvents) {
    journal.clockEvents = { "...": {
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
  await _acquireConnections(vlm, yargv, worker);
  const jobView = await _createView(vlm, yargv, worker, journal);
  const job = _createJob(vlm, yargv, jobView, journal);
  const interactive = yargv.interactive && jobView.runInteractive();
  let jobResult, jobError;
  try {
    jobResult = await job;
    vlm.finalizeClock();
    // TODO(iridian, 2020-02): Detach view and release resources.
    return jobResult;
  } catch (error) {
    throw (jobError = error);
  } finally {
    if ((interactive || {}).close) interactive.close(jobResult, jobError);
  }
}

async function _acquireConnections (vlm, yargv, worker) {
  worker.clockEvent("job.connections", "worker.acquireConnections(yargv.chronicles)");
  const connections = { root: (await worker.getGateway()).getRootConnection() };
  const chronicleURIs = yargv.chronicles || {};
  const focus = (yargv["job-view"] || {}).focus || (yargv.exec || {}).this;
  if (focus) {
    chronicleURIs.view = focus;
  }
  for (const [key, chronicleURI] of Object.entries(chronicleURIs)) {
    connections[key] = await (await worker.getGateway()).discourse
        .acquireConnection(chronicleURI.split("#")[0], { newChronicle: false })
        .asActiveConnection();
  }
  return connections;
}

async function _createView (vlm, yargv, worker, journal) {
  let jobName = yargv["job-name"];
  if (typeof jobName !== "string") jobName = `job-${vlm.contextIndex}`;
  worker.clockEvent("job.view.create", `worker.createView(${jobName})`);
  const viewConfig = {
    ...(yargv["job-view"] || {}),
    contextLensProperty: (yargv["job-view"] || {}).contextLensProperty
        ? [].concat(yargv["job-view"].contextLensProperty)
        : [yargv.attach ? "WORKER_LENS" : "JOB_LENS", "LENS"],
  };
  const jobView = await worker.createView(jobName, viewConfig);
  const viewValos = jobView.getRootScope().valos;
  // viewValos.view = jobView.getFocus().getConnection();
  viewValos.perspire.yargv = yargv;
  viewValos.perspire.journal = journal;
  return jobView;
}

async function _createJob (vlm, yargv, jobView, journal) {
  let { delay, repeats, interval, keepalive } = yargv;
  if (keepalive !== undefined) {
    vlm.warn("perspire --keepalive is DEPRECATED, see perspire --help");
    if (typeof keepalive !== "number") keepalive = keepalive ? 1 : 0;
    if (keepalive > 0) {
      interval = keepalive;
      repeats = true;
    } else {
      delay = Math.abs(keepalive);
      repeats = false;
    }
  }
  let options, jobSpindle, nextUncheckedEvent = 0;
  if (journal.jobBody) {
    options = {
      sourceInfo: {
        phase: "perspire.exec transpilation",
        source: journal.jobBody,
        mediaName: journal.jobOrigin,
        sourceMap: new Map(),
      },
    };
  } else if (journal.jobSpindleName) {
    jobSpindle = jobView.getGateway().getSpindle(journal.jobSpindleName);
    if (!jobSpindle.runJob) {
      throw new Error(`Spindle "${journal.jobSpindleName}" doesn't implement .runJob`);
    }
  }
  const heartbeat = yargv.heartbeat === true ? {}
      : (typeof yargv.heartbeat === "string") ? { heartbeat: yargv.heartbeat }
      : yargv.heartbeat;
  return jobView.createJob({
    delay,
    interval,
    repeats,
    async performTask (beat) {
      journal.beat = beat;
      journal.timeStamp = Date.now();
      const entry = { beat, ...heartbeat };
      const gateway = jobView.getGateway();
      if (gateway.getTotalCommandCount()) {
        entry.commandCount = gateway.getTotalCommandCount();
        entry.chronicles = gateway.getChronicleStatuses();
      }
      if (options || jobSpindle) {
        if (heartbeat) {
          entry.action = `running job '${journal.jobSpindleName || options.sourceInfo.mediaName}'`;
          jobView.clockEvent(`job.heartbeat.run`, entry);
        }
        try {
          this.product = await (jobSpindle
              ? jobSpindle.runJob(jobView, journal)
              : jobView.getFocus()
                  .doValoscript(options.kuery || journal.jobBody, {}, options));
        } catch (error) {
          entry.action = `caught exception: ${error.message}`;
          entry.message = error.message;
          entry.error = error;
          jobView.clockEvent(`job.heartbeat.run.error`, entry);
          const name = new Error("view.createJob.callback");
          jobView.outputErrorEvent(
              jobView.wrapErrorEvent(error, 1, () => [
                name,
                "\n\tjobBody:\n```", journal.jobBody, "\n```\n",
              ]),
              "Exception caught during job.heartbeat.run");
        }
      }
      if (heartbeat) {
        const jobHTML = jobView.getHTML();
        jobView.clockEvent(`job.heartbeat.dom`,
            { ...entry, action: "serializing DOM", html: jobHTML, product: this.product });
        if (yargv["job-html"]) {
          vlm.shell.ShellString(jobHTML).to(yargv["job-html"]);
          jobHTML.refreshHTML();
        }
      }
      if (yargv["stop-event"]) {
        while (nextUncheckedEvent < (vlm.clockEvents || []).length) {
          if (vlm.clockEvents[nextUncheckedEvent++].event === yargv["stop-event"]) {
            return true;
          }
        }
      }
      return undefined;
    },
  });
}
