// @ flow

export default function (global) {
  const window = global.window || global;
  return {
    window,
    console: global.console,
    document: window.document || global.document,
    FileReader: window.FileReader || global.FileReader,
  };
}
