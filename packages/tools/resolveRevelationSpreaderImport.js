Object.defineProperty(exports, "__esModule", { value: true });

const path = require("path");
const inBrowser = require("../gateway-api/inBrowser").default;

exports.default = function resolveRevelationSpreaderImport (reference, siteRoot,
  revelationRoot, domainRoot, currentRevelationPath
) {
  if ((reference[0] !== "<") || (reference[reference.length - 1] !== ">")) {
    return path.join(
        reference[0] === "/" ? (siteRoot || "") : (currentRevelationPath || revelationRoot),
        reference);
  }
  const uri = reference.slice(1, -1);
  if (uri[0] === "/") {
    if (inBrowser()) return uri;
    return path.join(domainRoot || siteRoot, uri.slice(1));
  }
  if (uri.match(/$[^/]*:/)) return uri; // absolute-ref uri: global reference
  // relative-path URI ref - revelation root relative ref
  return path.join(revelationRoot, uri);
}
