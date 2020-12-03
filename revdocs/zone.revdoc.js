
const {
  extractee: {
    // c, em, ref, cli, command, cpath, bulleted,
    authors,
    // pkg,
  },
} = require("@valos/revdoc");

const { name, version,
  // description, valos: { type } = {}
} = require("./../package");

const title = "Zone IDE";

module.exports = {
  "dc:title": title,
  "VRevdoc:package": name,
  "VRevdoc:version": version,
  respecConfig: {
    specStatus: "unofficial",
    shortName: "zone",
    editors: authors("iridian"),
    authors: authors("iridian"),
  },
  "chapter#abstract>0": {
    "#0": [
`Zone is the ValOS application development IDE. Zone itself is a ValOS
application and used to develop itself.
`,
    ],
  },
  "chapter#sotd>1": {
    "#0": [
`This document is a placeholder for the eventual Zone documentation.

Zone is in development and is not published yet. Its current internal
working version is referred to as 'Zero' and can be accessed via
Valaa Technologies infrastructure.
`,
    ],
  },
};
