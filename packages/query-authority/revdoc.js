
const {
  extractee: { authors, ref, /* cdata, context, cli, command, cpath, bulleted, pkg */ },
} = require("@valos/revdoc");

module.exports = {
  "dc:title": "query-authority",
  respecConfig: {
    specStatus: "unofficial",
    editors: authors("iridian"),
    authors: authors("Jaradacl", "iridian"),
    shortName: "queryauthority",
  },
  "chapter#abstract>0": [
    "This document is a revdoc template document 'queryauthority' created by create-revdoc.",
  ],
  "chapter#sotd>1": [
    "This document is part of the library workspace ",
    ref("@valos/query-authority"),
    " (of domain ", ref("@valos/kernel"), ") which is ",
    "Query authority serves virtual event logs based on various queries.",
  ],
  "chapter#introduction>2": [
    "Edit me - this is the first payload chapter. Abstract and SOTD are essential",
    ref("ReSpec boilerplate", "https://github.com/w3c/respec/wiki/ReSpec-Editor's-Guide#essential-w3c-boilerplate"),
    null,
    "See ", ref("ReVDoc tutorial", "@valos/revdoc/tutorial"),
    " for instructions on how to write revdoc source documents.",
    null,
    "See also ", ref("ReVdoc specification", "@valos/revdoc"),
    " and ", ref("VDoc specification", "@valos/vdoc"),
    " for reference documentation.",
  ],
};
