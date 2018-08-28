const setGlobalVars = require("indexeddbshim");

export function configure (initialConfig) {
  global.window = global;
  setGlobalVars(global.window, initialConfig);
}

export * from "~/tools/indexedDB/getBrowserDatabaseAPI";
