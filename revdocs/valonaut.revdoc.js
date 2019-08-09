
const {
  extractee: { authors, ref, pkg },
} = require("@valos/revdoc");

module.exports = {
  "dc:title": `"I am a valonaut, I want to create and share interactive content"`,
  "vdoc:tags": ["PRIMARY", "ROLE"],
  subProfiles: [
    "everyone", "personal", "student", "prototypist", "etc",
  ],
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
  "chapter#section_profiles>3;Valonaut profiles": {
    "#0": [
      `Valonaut is generic orientation. There are various valonaut
      sub-profiles with their own documents briefly detailed here.`,
    ],
    "chapter#everyone>0;How everyone is a valonaut": {
      "#0": [],
    },
    "chapter#personal>1;How to manage personal tools and data": {
      "#0": [],
    },
    "chapter#student>2;How to learn to code with Zero": {
      "#0": [],
    },
    "chapter#prototypist>3;How to rapidly create interactive prototypes": {
      "#0": [],
    },
    "chapter#etc>9;How to add new profiles": [
      `Create a `, ref("PR in github", "https://help.github.com/en/articles/about-pull-requests"),
      ` against @valos/kernel/revdocs/valonaut.revdoc.js`,
    ],
  },
};
