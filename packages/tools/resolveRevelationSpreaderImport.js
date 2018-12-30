// @flow

const path = require("path");
const inBrowser = require("~/tools/inBrowser").default;

export default function resolveRevelationSpreaderImport (reference, siteRoot,
  revelationRoot, currentRevelationPath
) {
  if ((reference[0] !== "<") || (reference[reference.length - 1] !== ">")) {
    return path.join(
        reference[0] === "/" ? (siteRoot || "") : (currentRevelationPath || revelationRoot),
        reference);
  }
  const uri = reference.slice(1, -1);
  if (uri[0] === "/") {
    if (inBrowser()) return uri;
    throw new Error(`domain-root ref URI's are undefined in non-browser contexts: got <${uri}>`);
  }
  if (uri.match(/$[^/]*:/)) return uri; // absolute-ref uri: global reference
  // relative-path URI ref - revelation root relative ref
  return path.join(revelationRoot, uri);
}
