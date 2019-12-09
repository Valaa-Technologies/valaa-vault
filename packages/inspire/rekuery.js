import fs from "fs";
import path from "path";

import VALEK from "~/engine/VALEK";
import { transpileValoscriptBody } from "~/script/transpileValoscript";

const _rekueryCache = {};

export default function rekuery (valoscriptPath, options = {}) {
  let mediaName = path.join(path.dirname(_getCallerFileName()), valoscriptPath);
  if ((mediaName.slice(-3) !== ".js") && (mediaName.slice(-3) !== ".vs")) {
    mediaName = `${mediaName}.vs`;
  }
  let kuery = _rekueryCache[mediaName];
  if (!kuery) {
    const source = fs.readFileSync(mediaName, "utf8");
    kuery = transpileValoscriptBody(source, {
      verbosity: options.verbosity || 0,
      customVALK: options.customVALK || VALEK,
      sourceInfo: options.sourceInfo || {
        phase: "rekuery transpilation",
        source,
        mediaName,
        sourceMap: options.sourceMap || new Map(),
      },
    });
    _rekueryCache[mediaName] = kuery;
  }
  return kuery;
}

function _getCallerFileName () {
  let ret;
  const origPrepareStackTrace = Error.prepareStackTrace;
  try {
    Error.prepareStackTrace = function getStack (_, stack) { return stack; };
    const err = new Error();
    const currentFile = err.stack.shift().getFileName();
    while (err.stack.length) {
      ret = err.stack.shift().getFileName();
      if (ret !== currentFile) break;
    }
  } catch (error) { throw error;/* unused */ }
  Error.prepareStackTrace = origPrepareStackTrace;
  return ret;
}
