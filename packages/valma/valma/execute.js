exports.command = "$ [command]";
exports.describe = "Execute a non-valma command within valma context";
exports.introduction = `${exports.describe}.

This is the command line shim to valma script vlm.execute.
Like 'npx -c' it executes a regular command exported by some package
dependency to the node_modules/.bin/ folder.

Unlike 'npx' which only searches the current directory and the global
cache '$' prepends all available valma pools to env.PATH, innermost
pool first.
`;

exports.builder = (yargs) => yargs.options({
  options: {
    type: "object",
    description: `vlm.execute options argument object.
Any nested objects are merged on top of their default values (see --env).`,
  },
  env: {
    type: "object",
    description: `alias for --options.spawn.env. The default value is process.env.`,
  }
});

exports.handler = (yargv) => {
  let options = yargv.options;
  if (yargv.env || ((yargv.options || {}).spawn || {}).env) {
    if (!options) options = {};
    if (!options.spawn) options.spawn = {};
    options.spawn.env = Object.assign({},
        process.env,
        ((yargv.options || {}).spawn || {}).env || {},
        yargv.env || {});
  }
  console.log("yargv.command:", yargv.command, ...yargv._);
  return yargv.vlm.execute([yargv.command, ...yargv._], options);
};
