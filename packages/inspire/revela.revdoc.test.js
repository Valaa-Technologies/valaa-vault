
const {
  extractee: {
    c, authors, blockquote, em, ref, context, cli, command, cpath, bulleted, pkg,
    prepareTestDoc,
  },
} = require("@valos/revdoc");

const { combineRevelationsLazily } = require("./Revelation");

const title = "revela.json format specification";
const { itExpects, runTestDoc } = prepareTestDoc(title);

const gateway = {
  siteRoot: "/site",
  domainRoot: "/",
  revelationRoot: "/site/revelation/",
  require (requireKey) { return { requireKey, someField: 1 }; },
  fetch (fetchOptions) { return { fetchOptions, fetchedField: 1 }; },
  wrapErrorEvent (error) { throw error; },
};

module.exports = {
  "dc:title": title,
  respecConfig: {
    specStatus: "unofficial",
    editors: authors("iridian"),
    authors: authors(),
    shortName: "revela",
  },
  "chapter#abstract>0": {
    "#0": [
`revela.json (pronounced: `, em("revelation"), ` is a JSON
configuration file in which all "!!!" key values are evaluated and
their results then spread on top of the surrounding object.

The evaluation allows for VPath operations, most notably including
importing
.`],
  },
  "chapter#sotd>1": {
    "#0": [
`This document is part of the library workspace `, pkg("@valos/inspire"), `
(of domain `, pkg("@valos/kernel"), `) which has the description:
\`ValOS Inspire application gateway\`.`,
    ],
  },
  "chapter#introduction>2": {
    "#0": [
``,
    ],
    "example#1": itExpects("trivial combine",
        () => combineRevelationsLazily(gateway, { a: [1] }, { a: [2] }),
        "toEqual",
        { a: [1, 2] }),
    "example#2": itExpects("spreads a simple relative require",
        () => combineRevelationsLazily(gateway, {}, { "!!!": "./path" }),
        "toEqual",
        { requireKey: "/site/revelation/path", someField: 1 }),
    "example#3": itExpects("spread of an explicit site root import followed by field access",
        () => combineRevelationsLazily(gateway, "",
            { "!!!": [["!$revela:import", "/path"], "requireKey"] }),
        "toEqual",
        "/site/path"),
    "example#4": itExpects("spread of an implicit URI import followed by array creation",
        async () => combineRevelationsLazily(gatewayMock, [], { "!!!": [
          ["!$revela:import", "<https://foobar.com/path>"],
          ["fetchedField", [".:fetchOptions:input"]],
        ] }),
        "toEqual",
        [1, "https://foobar.com/path"]),
  },
};

runTestDoc();
