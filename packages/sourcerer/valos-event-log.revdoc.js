
const {
  extractee: { authors, pkg },
} = require("@valos/revdoc");

module.exports = {
  "dc:title": "ValOS Event Log",
  respecConfig: {
    specStatus: "unofficial",
    editors: authors("iridian"),
    authors: authors(),
    shortName: "eventLog",
  },
  "chapter#abstract>0": {
    "#0": [
`ValOS Event Log is an ordered, numbered sequence of JSON-LD documents.
Each document represents a single event. Together these events
incrementally, exclusively and deterministically specify the state
changes of a single valospace chronicle from its initial empty state to
the current state after the most recent event.`,
    ],
  },
  "chapter#sotd>1": {
    "#0": [
`This document is part of the library workspace `, pkg("@valos/sourcerer"), `
but is \`NOT SUPPORTED NOR IMPLEMENTED\` by it yet in any manner.`,
    ],
  },
  "chapter#introduction>2": {
    "#0": [
"TODO.",
    ],
  },
};
