
const {
  extractee: { c, authors, em, ref, context, cli, command, cpath, bulleted, pkg },
} = require("@valos/revdoc");

module.exports = {
  "dc:title": `"I am a ValOS voyager, I want to discover ValOS and enlighten others"`,
  "vdoc:tags": ["PRIMARY", "ROLE"],
  respecConfig: {
    specStatus: "unofficial",
    editors: authors("iridian"),
    authors: authors(),
    shortName: "voyager",
  },
  "chapter#abstract>0": [
    `This document is the first introduction for ValOS voyagers -
    the first adopters, entrepreneurs and evangelists - to the ValOS
    ecosystem, its philosophy and its ultimate goals.`,
  ],
  "chapter#sotd>1": [
    "This document is part of the vault workspace ",
    pkg("@valos/kernel"),
    " (of domain ", pkg("@valos/kernel"), ") which is ",
    "ValOS common infrastructure tools and libraries monorepository.",
  ],
  "chapter#introduction>2;How do I discover opportunities and enlighten others?": [
    `As a voyager you have stakes that matter. Whether you were to
    invest on a ValOS collaborator as a financier, to adopt ValOS as
    technology as an executive or to commit your personal time and
    energy on a ValOS project you need to `, em("see"), ` forward.`,
    null,
    `To make sound decisions and to position yourself proactively you
    need to understand the big picture and philosophy of the ValOS
    ecosystem. Only then you can enlighten others.`,
  ],
};
