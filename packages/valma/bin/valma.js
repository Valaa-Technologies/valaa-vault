#!/usr/bin/env node

const shell = require("shelljs");
const path = require("path");
const globToRegExp = require("glob-to-regexp");

/* eslint-disable vars-on-top, no-var, no-loop-func, no-restricted-syntax, no-cond-assign */

const packageName = "package.json";
const dependedPoolPath = "node_modules/.bin/";
var globalPoolPath;

var commandPools = [];

const command = process.argv[2];
const valmaCommandRegex = globToRegExp(`valma-${command || "*"}`);

function tryAddValmaCommand (key, pool, poolEntry, forwardValmaPrefix) {
  if (key.match(valmaCommandRegex)) {
    pool.commands[key.slice(6)] = poolEntry;
  } else if ((key === "vlm") && (typeof forwardValmaPrefix === "string")) {
    const hasGlobalValma = shell.which("vlm");
    var setEnv = "";
    if (hasGlobalValma && !process.env.VALMA_GLOBAL) {
      setEnv = `VALMA_GLOBAL=${hasGlobalValma} `;
    } else if (!process.env.VALMA_LOCAL) {
      const valmaLocal = path.resolve(process.cwd(), forwardValmaPrefix || "bin");
      setEnv = `VALMA_LOCAL=${valmaLocal} PATH=$PATH:${valmaLocal} `;
    }
    // console.log(`Forwarding to valma at: ${setEnv}${forwardValmaPrefix}${valma}`);
    shell.exec(`${setEnv}npx -c "${forwardValmaPrefix}${
        forwardValmaPrefix ? "vlm" : path.join("bin", "vlm")} ${
        process.argv.slice(2).map(a => JSON.stringify(a)).join(" ")}"`);
    process.exit();
  }
}

const needToPrepareEnv = !process.env.npm_package_name
    || !(process.env.VALMA_LOCAL || process.env.VALMA_GLOBAL);

var shouldForward;
if (shell.test("-f", packageName)) {
  var packageConfig = JSON.parse(shell.head({ "-n": 100000 }, packageName)).scripts;
  var scriptPool = { name: "package", commands: {}, poolPath: "package.json:script." };
  shouldForward = needToPrepareEnv || (process.argv[1].indexOf("bin/vlm") === -1);
  for (var key of Object.keys(packageConfig)) {
    tryAddValmaCommand(key, scriptPool, packageConfig[key], shouldForward && "");
  }
  commandPools.push(scriptPool);
}

if (shell.test("-d", dependedPoolPath)) {
  const dependedScripts = shell.ls("-l", dependedPoolPath);
  var dependedPool = { name: "depended", commands: {}, poolPath: dependedPoolPath };
  shouldForward = needToPrepareEnv || (process.argv[1].indexOf(process.cwd()) !== 0);
  dependedScripts.forEach(script => {
    tryAddValmaCommand(script.name, dependedPool, { script, pool: dependedPool },
        shouldForward && dependedPoolPath);
  });
  commandPools.push(dependedPool);
}

const globalValmaPath = !process.env.VALMA_LOCAL
    && (process.env.VALMA_GLOBAL || shell.which("vlm"));
if (globalValmaPath) {
  globalPoolPath = globalValmaPath.match(/(.*(\/|\\))vlm/)[1];
  const globalPool = { name: "global", commands: {}, poolPath: globalPoolPath };
  shell.ls("-l", globalPoolPath).forEach(script => {
    script.global = true;
    tryAddValmaCommand(script.name, globalPool, { script, pool: globalPool },
        needToPrepareEnv && globalPoolPath);
  });
  commandPools.push(globalPool);
}

// Have matching global command names execute first (while obeying overrides properly ofc.)
commandPools.reverse();

if (!command) {
  console.log("Usage: vlm <command> [<args>]\n");
  var align = 0;
  for (var p of commandPools) {
    Object.keys(p.commands).forEach(name => { if (name.length > align) align = name.length; });
  }
  for (var pool of commandPools) {
    if (!Object.keys(pool.commands).length) {
      console.log(`\t'${pool.name}' commands empty (pool at "${pool.poolPath}valma-<command>")`);
    } else {
      console.log(`\t'${pool.name}' commands (in pool "${pool.poolPath}valma-<command>"):`);
      Object.keys(pool.commands).forEach(commandName => {
        const cmd = pool.commands[commandName];
        console.log(commandName, `${" ".repeat(align - commandName.length)}:`,
            `${typeof cmd === "string" ? cmd : `${pool.poolPath}valma-${commandName}`}`);
      });
      console.log();
    }
  }
  process.exit(0);
}

const activeCommands = Object.assign({}, ...commandPools.map(p => p.commands));

if (!Object.keys(activeCommands).length) {
  if (command.indexOf("*") !== -1) process.exit(0);
  console.log(`vlm: cannot find command '${command}' from paths:`,
      ...commandPools.map(emptyPool => `"${path.join(emptyPool.poolPath, "valma")}-${command}"`));
  process.exit(-1);
}

const commandArgs = process.argv.slice(3).map(arg => JSON.stringify(arg)).join(" ");

var ret;

for (var executeePool of commandPools) {
  for (var executeeName of Object.keys(executeePool.commands)) {
    var commandContent = activeCommands[executeeName];
    if (!commandContent) continue;
    var dispatch;
    if (typeof commandContent === "string") {
      dispatch = `${commandContent} ${commandArgs}`;
    } else {
      dispatch = `${commandContent.pool.poolPath}valma-${executeeName} ${commandArgs}`;
    }
    // console.log(`Executing command '${dispatch}'`);
    ret = shell.exec(dispatch);
    delete activeCommands[executeeName];
  }
}

process.exit(ret.code);
