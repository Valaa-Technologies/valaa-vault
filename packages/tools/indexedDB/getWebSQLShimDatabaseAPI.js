const setGlobalVars = require("indexeddbshim");

global.window = global;
setGlobalVars(global.window, { checkOrigin: false });

export * from "~/tools/indexedDB/getBrowserDatabaseAPI";
