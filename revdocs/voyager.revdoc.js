
const {
  extractee: { authors, em, ref, pkg },
} = require("@valos/revdoc");

module.exports = {
  "dc:title": `"I am a ValOS voyager, I want to discover ValOS and enlighten others"`,
  "vdoc:tags": ["PRIMARY", "ROLE"],
  subProfiles: [
    "enthusiast", "entrepreneur", "evangelist", "investor", "business_owner",
    "sales_rep", "etc"
  ],
  respecConfig: {
    specStatus: "unofficial",
    editors: authors("iridian"),
    authors: authors(),
    shortName: "voyager",
  },
  "chapter#abstract>0": {
    "#0": [
`This document is the first introduction for ValOS voyagers - the first
adopters, entrepreneurs and evangelists - to the ValOS ecosystem, its
philosophy and its ultimate goals.`,
    ],
  },
  "chapter#sotd>1": {
    "#0": [
`This document is part of the vault workspace `, pkg("@valos/kernel"), `
(of domain `, pkg("@valos/kernel"), `) which has the description:
\`ValOS common infrastructure tools and libraries monorepository\`.`,
    ],
  },
  "chapter#introduction>2;How do I discover opportunities and enlighten others?": {
    "#0": [
`As a voyager you have stakes that matter. Whether you were to
invest on a ValOS collaborator as a financier, to adopt ValOS as
technology as an executive or just to commit your personal time and
energy on a ValOS project you need to `, em("see"), ` forward.

To make sound decisions and to position yourself proactively you
need to understand the big picture and philosophy of the ValOS
ecosystem. Only then you can enlighten others.

You use tailored but real-world ValOS demo setups to illustrate
how ValOS a solution could be configured to meet the needs at hand.
Your audience can be your customer, your team or even just
yourself.`,
    ],
  },
  "chapter#section_profiles>3;Voyager profiles": {
    "#0": [
`Voyager is generic orientation. There are various voyager sub-profiles
with their own documents briefly detailed here.`,
    ],
    "chapter#enthusiast>0;How enthusiasts impress themselves and others": {
      "#0": [],
    },
    "chapter#entrepreneur>1;How entrepreneurs search for uncharted business opportunities": {
      "#0": [],
    },
    "chapter#evangelist>2;How evangelists enlighten about new innovations": {
      "#0": [],
    },
    "chapter#investor>3;How investors perform due diligence": {
      "#0": [],
    },
    "chapter#business_owner>4;How business owners understand the consequences of their choices": {
      "#0": [],
    },
    "chapter#sales_rep>5;How sales representatives identify solutions to customer needs": {
      "#0": [],
    },
    "chapter#etc>9;How to add new profiles": {
      "#0": [
`Create a `, ref("PR in github", "https://help.github.com/en/articles/about-pull-requests"), `
against @valos/kernel/revdocs/valonaut.revdoc.js`,
      ],
    },
  },
};
