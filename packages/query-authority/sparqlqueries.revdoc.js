
const {
  extractee: { cdata, authors, ref, context, cli, command, cpath, bulleted, pkg },
} = require("@valos/toolset-vault/revdoc");

module.exports = {
  "dc:title": "SPARQL Queries for PoT/TTP hypertwin",
  respecConfig: {
    specStatus: "unofficial",
    editors: authors("iridian"),
    authors: authors("iridian", "Jaradacl"),
    shortName: "sparql-queries",
  },
  "chapter#abstract>0": [
    "This document is a revdoc template document 'sparqlqueries' created by create-revdoc.",
  ],
  "chapter#sotd>1": [
    "This document is part of the vault workspace ",
    ref("@valos/kernel_"),
    " (of domain ", ref("@valos/kernel"), ") which is ",
    "ValOS common infrastructure tools and libraries monorepo.",
  ],
  "chapter#introduction>2": [
    "Edit me - this is the first payload chapter. Abstract and SOTD are essential",
    ref("ReSpec boilerplate", "https://github.com/w3c/respec/wiki/ReSpec-Editor's-Guide#essential-w3c-boilerplate"),
    null,
    "See ", ref("ReVDoc tutorial", "@valos/toolset-vault/revdoc/tutorial"),
    " for instructions on how to write revdoc source documents.",
    null,
    "See also ", ref("ReVdoc specification", "@valos/toolset-vault/revdoc"),
    " and ", ref("VDoc specification", "@valos/toolset-vault/vdoc"),
    " for reference documentation.",
  ],
};
