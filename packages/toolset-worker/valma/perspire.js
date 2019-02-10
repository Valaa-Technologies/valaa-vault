#!/usr/bin/env vlm

exports.vlm = { toolset: "@valos/toolset-worker" };
exports.command = "perspire [revelationPath] [additionalRevelationPaths..]";
exports.describe = "Launch headless worker for performing virtual DOM ValOS computation";

exports.disabled = (yargs) => !yargs.vlm.packageConfig && "No package.json found";
exports.builder = (yargs) => yargs.option({
  output: {
    type: "string",
    default: "",
    description: "Outputs rendered output as a HTML string to a file",
  },
  keepalive: {
    default: false,
    description: `Keeps server alive after initial run. If keepalive is a number then ${
        ""}the possible output will be rendered every 'keepalive' seconds.`,
  },
  plugin: {
    type: "string",
    array: true,
    default: [],
    description: "List of plugin id's which are require'd before gateway creation.",
  },
  cacheRoot: {
    type: "string",
    default: "dist/perspire/cache/",
    description: "Cache root path for indexeddb sqlite shim and other cache storages",
  },
  revelation: {
    description: "Direct revelation object that is placed after all other revelations",
  },
  revelationRoot: {
    type: "string",
    description: `Explicit gateway.options.revelationRoot path ${
        ""}(by default path.dirname(revelationPath))`,
  },
});

exports.handler = async (yargv) => {
  // revelationPaths parsing
  global.window = global;
  const startNodePerspireServer = require("@valos/inspire/PerspireServer").startNodePerspireServer;

  const vlm = yargv.vlm;
  let revelationPath = yargv.revelationPath || "./revela.json";
  let revelationRoot = yargv.revelationRoot;
  if (revelationRoot === undefined) {
    revelationRoot = vlm.path.dirname(revelationPath);
    revelationPath = vlm.path.basename(revelationPath);
  } else {
    revelationPath = vlm.path.resolve(revelationPath);
  }
  (yargv.plugin || []).forEach(plugin => require(plugin));
  vlm.shell.mkdir("-p", yargv.cacheRoot);

  const server = await startNodePerspireServer({
    logger: vlm,
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
    // plugins: yargv.plugin,
    databaseBasePath: yargv.cacheRoot,
  });
  const keepaliveInterval = (typeof yargv.keepalive === "number")
      ? yargv.keepalive : (yargv.keepalive && 1);
  if (!keepaliveInterval) {
    vlm.info("No keepalive enabled");
    return { exited: "immediate rendering", domString: server.serializeMainDOM() };
  }
  vlm.info(`Setting up keepalive render every ${keepaliveInterval} seconds`);
  return server.run(Math.abs(keepaliveInterval), (index) => {
    const domString = server.serializeMainDOM();
    if (yargv.output) {
      vlm.shell.ShellString(domString).to(yargv.output);
      vlm
      .ifVerbose(1).babble(`heartbeat ${index}:`, `wrote ${domString.length} dom string chars to "${
          yargv.output}"`)
      .ifVerbose(2).expound("\tdom string:\n", domString);
    } else {
      vlm
      .ifVerbose(1).babble(`heartbeat ${index}:`, `discarded ${domString.length} dom string chars`)
      .ifVerbose(2).expound("\tdom string:\n", domString);
    }
    if (keepaliveInterval >= 0) return undefined;
    return { exited: "delayed single shot rendering", domString };
  });
};
