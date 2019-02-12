// @ flow

import getGlobal from "~/gateway-api/getGlobal";

export default function () {
  const global = getGlobal();
  const window = global.window || global;
  return {
    window,
    console: global.console,
    document: window.document || global.document,
    FileReader: window.FileReader || global.FileReader,
  };
}
