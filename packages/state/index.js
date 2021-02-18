const baseContextText = `{
  "^": "urn:valos:",
  "@base": "_:",
  "@vocab": "urn:valos:.$.",

  "V": "https://valospace.org/0#",

  "*": { "@id": "V:ownsEntity", "@type": "@id", "@container": "@id" },
  "-": { "@id": "V:ownsRelation", "@type": "@id", "@container": "@id" },
  "~": { "@id": "V:ownsMedia", "@type": "@id", "@container": "@id" },
  ".": { "@id": "V:ownsProperty", "@type": "@id", "@container": "@id" },
  "_": { "@id": "V:ownsGhost", "@type": "@id", "@container": "@id" },

  ".I": { "@id": "V:instanceOf", "@type": "@id" },
  ".G": { "@id": "V:ghostOf", "@type": "@id" },

  ".N": { "@id": "V:name" },
  ".P": { "@id": "V:name", "@type": "@id" },

  ".S": { "@id": "V:subject", "@type": "@id" },
  ".O": { "@id": "V:object" },

  ".S.": { "@id": "V:scope", "@type": "@id" },
  ".O.": { "@id": "V:value", "@type": "@id" },

  ".S*": { "@id": "V:parent", "@type": "@id" },
  ".O*": { "@id": "V:id", "@type": "@id" },

  ".S~": { "@id": "V:folder", "@type": "@id" },
  ".O~": { "@id": "V:content", "@type": "@id" },

  ".S-": { "@id": "V:source", "@type": "@id" },
  ".O-": { "@id": "V:target", "@type": "@id" },

  ".S-!": { "@id": "V:graphSource", "@type": "@id" },
  ".O-!": { "@id": "V:graphTarget", "@type": "@id" },

  "-out": { "@id": "V:outRelation", "@type": "@id", "@container": "@list" },
  "-in": { "@id": "V:inRelation", "@type": "@id", "@container": "@list" },

  "VLog": "https://valospace.org/log/0#",
  "VSourcerer": "https://valospace.org/sourcerer/0#",
  "VState": "https://valospace.org/state/0#",

  "~u4": "https://valospace.org/state/u4/0#"
}`;

const baseContext = JSON.parse(baseContextText);

module.exports = {
  baseContext,
  baseContextText,
};
