
const {
  extractee: { authors, ref, /* cdata, context, cli, command, cpath, bulleted, pkg */ },
} = require("@valos/type-vault/revdoc");

module.exports = {
  "dc:title": "ReVDoc Tutorial",
  respecConfig: {
    specStatus: "unofficial",
    editors: authors("iridian"),
    authors: authors(),
    shortName: "tutorial",
  },
  "chapter#abstract>0": [
    "This document is a revdoc template document 'tutorial' created by create-revdoc.",
  ],
  "chapter#sotd>1": [
    "This document is part of the toolset workspace ",
    ref("@valos/type-vault"),
    " (of domain ", ref("packages"), ") which is ",
    "A valma toolset for managing valos vault monorepository workspaces",
  ],
  "chapter#introduction>2": [
  "Edit me - this is the first payload chapter. Abstract and SOTD are essential",
  ref("ReSpec boilerplate", "https://github.com/w3c/respec/wiki/ReSpec-Editor's-Guide#essential-w3c-boilerplate"),
  null,
  "See ", ref("ReVDoc tutorial", "@valos/type-vault/revdoc/tutorial"),
  " for instructions on how to write revdoc source documents.",
  null,
  "See also ", ref("ReVdoc specification", "@valos/type-vault/revdoc"),
  " and ", ref("VDoc specification", "@valos/type-vault/vdoc"),
  " for reference documentation.",
],
};
