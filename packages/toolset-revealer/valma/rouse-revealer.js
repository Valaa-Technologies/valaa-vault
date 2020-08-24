#!/usr/bin/env vlm

exports.vlm = { toolset: "@valos/toolset-revealer" };
exports.command = "rouse-revealer";
exports.describe = "Launch a webpack-dev-server at localhost serving a local revelation";
exports.introduction =
`The revelation consists of two parts: webpack output and static files.
Webpack output is configured by the project root webpack.config.js and
the static files are served from --content-base. If this --content-base
doesn't exist it is created by copying all files from the directory(s)
provided by --content-source.`;

exports.builder = function builder (yargs) {
  return yargs.option({
    "content-base": {
      type: "string", default: "dist/revealer",
      description: "The revelations serve directory as --content-base for webpack-dev-server",
    },
    "content-source": {
      type: "string", array: true, default: ["./revelations"],
      description: "The revelations source directory for populating an empty content-base",
    },
    "content-target": {
      type: "string", default: "",
      description: "Target subdirectory for populated content",
    },
    host: {
      type: "string", default: "0.0.0.0",
      description: "The local ip where the server will be bound"
    },
    check: {
      type: "boolean", default: true,
      description: "if false, webpack-dev-server --disable-host-check option"
    },
    inline: {
      type: "boolean", default: true,
      description: "webpack-dev-server --inline option"
    },
    progress: {
      type: "boolean", default: true,
      description: "webpack-dev-server --progress option"
    },
    open: {
      type: "boolean", default: true,
      description: "webpack-dev-server --open option. A string argument is provided to --openPage"
    },
    prod: {
      type: "boolean",
      description: "set TARGET_ENV=production, emulating production environment",
    },
    dev: {
      type: "boolean",
      description: "if false, set TARGET_ENV=local, otherwise emulates development environment",
    }
  });
};
exports.handler = async function handler (yargv) {
  const vlm = yargv.vlm;
  const contentBase = yargv["content-base"] || "";
  let contentSources = yargv["content-source"] || [];
  if (!contentSources[0]) contentSources = [];
  if ((contentBase || yargv["content-target"]) && contentSources.length) {
    const targetDir = vlm.path.join(contentBase, yargv["content-target"]);
    vlm.info("Creating and populating content directory",
        vlm.theme.path(targetDir), `from ${vlm.theme.path(String(yargv["content-source"]))}`);
    vlm.shell.mkdir("-p", targetDir);
    contentSources.forEach(source =>
        vlm.shell.cp("-R", vlm.path.join(source, "*"), targetDir));
  }

  vlm.info(`${vlm.theme.bold("Rousing revealer")} using ${
      vlm.theme.executable("webpack-dev-server")} with revelation content base:`,
          vlm.theme.path(contentBase));
  const env = { ...process.env };
  if (yargv.prod) env.TARGET_ENV = "production";
  else if (!yargv.dev) env.TARGET_ENV = "local";
  return vlm.interact([
    "webpack-dev-server",
    yargv.inline && "--inline",
    yargv.progress && "--progress",
    !yargv.check && "--disable-host-check",
    yargv.open && "--open",
    ...((typeof yargv.open === "string") ? ["--open-page", yargv.open] : []),
    "--host", yargv.host,
    "--content-base", contentBase,
  ], { spawn: { env } });
};
