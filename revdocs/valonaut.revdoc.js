
const {
  extractee: { c, authors, ref, context, cli, command, cpath, bulleted, pkg },
} = require("@valos/revdoc");

module.exports = {
  "dc:title": `"I am a valonaut, I want to create and share interactive content"`,
  "vdoc:tags": ["PRIMARY", "ROLE"],
  respecConfig: {
    specStatus: "unofficial",
    editors: authors("iridian"),
    authors: authors(),
    shortName: "valonaut",
  },
  "chapter#abstract>0": [
    `This document is the first introduction for valonauts - the
    primary content creators - to the ValOS ecosystem and its core
    tools.`,
  ],
  "chapter#sotd>1": [
    "This document is part of the vault workspace ",
    pkg("@valos/kernel"),
    " (of domain ", pkg("@valos/kernel"), ") which is ",
    "ValOS common infrastructure tools and libraries monorepository.",
  ],
  "chapter#introduction>2;How do I create and share interactive content?": [
    `As a valonaut you create, share and deploy web content and
    interactive applications fully from inside `, ref("Valospace"), ".",
    null,
    `You use a web editor called `, ref("Zero"), ` and with it employ
    traditional web technologies; HTML5, CSS and the Javascript
    dialect `, ref("valoscript", "@valos/script"),
    null,
    `The skills you learn to do this are like cycling or writing - they
    are used to support your other interests. While you don't need to
    become a professional you certainly can!`,
  ],
};
