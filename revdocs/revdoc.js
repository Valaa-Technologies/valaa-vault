
const {
  extractee: { authors, ref },
} = require("@valos/revdoc");

module.exports = {
  "dc:title": "@valos/kernel domain",
  respecConfig: {
    specStatus: "unofficial",
    editors: authors("iridian"),
    authors: authors(),
    shortName: "kernel-domain",
  },
  "chapter#abstract>0": [
    `@valos/kernel domain hosts all core infrastructure components of
    ValOS - the Valaa Open System.`,
  ],
  "chapter#sotd>1": [
    "This document is part of the vault workspace ", ref("@valos/kernel"),
    " (of domain ", ref("@valos/kernel"), ") which is ",
    "ValOS common infrastructure tools and libraries monorepo.",
  ],
  "chapter#introduction>2": [
    "No content yet.",
  ],
};
