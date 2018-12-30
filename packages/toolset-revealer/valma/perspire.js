#!/usr/bin/env vlm

const path = require("path");

// some web to node env emulation
global.self = global;
global.name = "Perspire window";
global.window = global;

const PerspireServer = require("@valos/inspire/PerspireServer").default;

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
  // Example template which displays the command name itself and package name where it is ran
  // Only enabled inside package
  const vlm = yargv.vlm;
  const revelationPaths = (yargv.revelationPaths || []).length
      ? yargv.revelationPaths : ["./revela.json"];
  yargv.plugin.forEach(element => {
    require(path.join(process.cwd(), element));
  });
  vlm.shell.mkdir("-p", yargv.cacheRoot);

  const server = new PerspireServer({
    revelationRoot: (yargv.revelationRoot !== undefined)
        ? yargv.revelationRoot
        : vlm.path.dirname(revelationPaths[0]),
    revelations: [
      { gateway: { scribe: { databaseConfig: {
        // See https://github.com/axemclion/IndexedDBShim for config options
        databaseBasePath: yargv.cacheRoot,
        checkOrigin: false,
      } } } },
      ...revelationPaths.map(p => {
        if (!vlm.shell.test("-f", p)) throw new Error(`Cannot open file '${p}' for reading`);
        return { "...": p };
      }),
      yargv.revelation || {},
    ],
    pluginPaths: yargv.plugin,
    outputPath: yargv.output,
  });
  await server.start();
  const interval = (typeof yargv.keepalive === "number") ? yargv.keepalive : (yargv.keepalive && 1);
  if (interval) {
    console.warn("Setting up keepalive render every", interval, "seconds");
    await server.run(interval);
  } else {
    console.warn("No keepalive enabled");
  }
  return "Exiting perspire handler";
};
