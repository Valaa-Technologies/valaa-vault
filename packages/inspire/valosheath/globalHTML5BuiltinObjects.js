// @ flow

export default function (global) {
  const window = global.window || global;
  return {
    window,
    fetch: window.fetch || global.fetch,
    Headers: window.Headers || global.Headers,
    Request: window.Request || global.Request,
    Response: window.Response || global.Response,
    console: global.console,
    document: window.document || global.document,
    FileReader: window.FileReader || global.FileReader,
  };
}
