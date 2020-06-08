#!/usr/bin/env vlm

exports.command = "clean-vault";
exports.describe = "Clean various more or less transient vault files and subdirectories";
exports.introduction =
`By default the three elements installed by 'yarn install' are cleaned:
1. workspace packages by 'lerna clean --yes'
2. yalc local dependencies by 'yalc remove --all'
3. vault root node_modules by 'rm -rf'

In addition, dist/ can be removed with --dist in preparation for a clean slate publish/deploy ops.
Be mindful that all of dist/ will be removed.
yarn.lock can be removed with --yarn in preparation for persisted dependency updates.`;

exports.disabled = (yargs) => !yargs.vlm.getPackageConfig() && "No package.json found";
exports.builder = (yargs) => {
  const vlm = yargs.vlm;
  return yargs.options({
    yes: {
      type: "boolean",
      description: "Answer yes to all confirmations",
    },
    "at-root": {
      type: "boolean", default: true,
      description: "Execute all cleanup commands at innermost package root",
    },
    yalc: {
      type: "boolean", default: true,
      description: `Execute '${vlm.theme.executable("yalc remove --all")}'`,
    },
    lerna: {
      type: "boolean", default: true,
      description: `Execute '${vlm.theme.executable("lerna clean")}'`,
    },
    node_modules: {
      type: "boolean", default: true,
      description: `Execute '${vlm.theme.executable("rm -r node_modules/")}'`,
    },
    dist: {
      type: "boolean",
      description: `Execute '${vlm.theme.executable("rm -r dist/")}' (not default)`,
    },
    yarn: {
      type: "boolean",
      description: `Execute '${vlm.theme.executable("rm yarn.lock")}' (not default)`,
    },
    install: {
      type: "boolean",
      description: `Execute '${vlm.theme.executable("yarn install")}' after all other steps`,
    },
  });
};

exports.handler = async (yargv) => {
  // Example template which displays the command name itself and package name where it is ran
  // Only enabled inside package
  const vlm = yargv.vlm;
  const ret = {};
  if (yargv["at-root"] && !vlm.shell.test("-f", "package.json")) {
    throw new Error(`valma-clean-vault --at-root requested when not at package root ${
        ""}(TODO: implement the directory change for this option)`);
  }
  if (yargv.yalc) {
    await vlm.delegate(["yalc", "remove", { all: true }]);
    ret["yalc dependencies"] = "removed";
  }
  if (yargv.lerna) {
    await vlm.delegate(["lerna", "clean", { yes: true }]);
    ret["lerna workspaces"] = "cleaned";
  }
  for (const key of Object.keys(ret)) ret[key] = await ret[key];
  if (yargv.node_modules && vlm.shell.test("-e", "node_modules")) {
    const result = await vlm.shell.rm("-rf", "node_modules/");
    ret["./node_modules/"] = !vlm.shell.error() ? "removed" : result.stderr;
  }
  if (yargv.dist && vlm.shell.test("-e", "dist")) {
    const result = await vlm.shell.rm("-rf", "dist/");
    ret["./dist/"] = !vlm.shell.error() ? "removed" : result.stderr;
  }
  if (yargv.yarn && vlm.shell.test("-e", "yarn.lock")) {
    const result = await vlm.shell.rm("yarn.lock");
    ret["./yarn.lock"] = !vlm.shell.error() ? "removed" : result.stderr;
  }
  if (yargv.install) {
    ret["yarn install"] = (await vlm.interact(["yarn", "install"], { onSuccess: "done" }));
  }
  return ret;
};
