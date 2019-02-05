#!/usr/bin/env vlm

const path = require("path");

exports.command = "perspire [revelationPaths..]";
exports.describe = "headless server-side environment";

exports.disabled = (yargs) => !yargs.vlm.packageConfig;
exports.builder = (yargs) => yargs.option({
  output: {
    type: "string",
    default: "",
    description: "Outputs rendered output as a HTML string to a file",
  },
  keepalive: {
    default: false,
    description: `Keeps server alive after initial run. If a number then the output will be ${
        ""}rendered every 'keepalive' seconds.`,
  },
  plugin: {
    type: "string",
    array: true,
    default: [],
    description: "List of plugin paths to load at start",
  },
  cacheRoot: {
    type: "string",
    default: "dist/perspire/cache/",
    description: "Cache root path for indexeddb sqlite shim and other cache storages",
  },
  revelation: {
    description: "Direct revelation object applied after all other revelations",
  },
  revelationRoot: {
    type: "string",
    description: `Explicit gateway.options.revelationRoot path ${
        ""}(by default the first revelationPaths dirname)`,
  },
});

exports.handler = async (yargv) => {
  // revelationPaths parsing
  global.window = global;
  const startNodePerspireServer = require("@valos/inspire/PerspireServer").startNodePerspireServer;

  const vlm = yargv.vlm;
  const revelationPaths = (yargv.revelationPaths || []).length
      ? yargv.revelationPaths : ["./revela.json"];
  yargv.plugin.forEach(element => {
    require(path.join(process.cwd(), element));
  });
  vlm.shell.mkdir("-p", yargv.cacheRoot);

  const server = await startNodePerspireServer({
    revelationRoot: (yargv.revelationRoot !== undefined)
        ? yargv.revelationRoot
        : vlm.path.dirname(revelationPaths[0]),
    revelations: [
      ...revelationPaths.map(p => {
        if (!vlm.shell.test("-f", p)) throw new Error(`Cannot open file '${p}' for reading`);
        return { "...": p };
      }),
      yargv.revelation || {},
    ],
    databaseBasePath: yargv.cacheRoot,
    pluginPaths: yargv.plugin,
    outputPath: yargv.output,
  });
  const keepaliveInterval = (typeof yargv.keepalive === "number")
      ? yargv.keepalive : (yargv.keepalive && 1);
  if (keepaliveInterval) {
    console.warn("Setting up keepalive render every", keepaliveInterval, "seconds");
    await server.run(keepaliveInterval);
  } else {
    console.warn("No keepalive enabled");
  }
  return "Exiting perspire handler";
};
