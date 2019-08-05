const { extractee: { ref, strong } } = require("@valos/revdoc");

const documentHeaders = {
  "header#0": {
    "vdoc:cell": strong(ref("vdoc:selectKey")),
    "vdoc:content": ["Name"],
  },
  /*
  "header#0": {
    "vdoc:cell": { "rdf:type": "vdoc:TemplateSelector",
      "vdoc:content": ["vdoc:selectKey"],
      "vdoc:ref": "vdoc:ref",
    },
    "vdoc:content": ["id"],
  },
  */
  "header#1;package": "Package",
  "header#2;version": "Version",
  "header#3": {
    "vdoc:cell": { "vdoc:words": { "vdoc:selectField": "tags" } },
    "vdoc:content": ["Tags"],
  },
  "header#8;title": {
    "vdoc:content": ["Title:"],
    "vdoc:wide": true,
  },
};
const summaryHeaders = {
  "header#0": {
    "vdoc:cell": strong(ref("vdoc:selectKey")),
    "vdoc:content": ["Name"],
  },
  "header#9;introduction": {
    "vdoc:content": ["Introduction:"],
    "vdoc:wide": true,
  },
};

const commandHeaders = {
  ...summaryHeaders,
  "header#1;package": "Package",
  "header#2;version": "Version",
};

module.exports = {
  headers: {
    introductionDocuments: {
      ...documentHeaders,
      "header#9;introduction": {
        "vdoc:content": ["Introduction:"],
        "vdoc:wide": true,
        "vdoc:tall": true,
      },
    },
    apiReferenceDocuments: {
      ...documentHeaders,
      "header#9;apiAbstract": {
        "vdoc:content": ["API abstract:"],
        "vdoc:wide": true,
        "vdoc:tall": true,
      },
    },
    ontologyDocuments: {
      ...documentHeaders,
      "header#9;ontologyAbstract": {
        "vdoc:content": ["Ontology abstract:"],
        "vdoc:wide": true,
        "vdoc:tall": true,
      },
    },
    primaryDocuments: {
      ...documentHeaders,
      "header#9;abstract": {
        "vdoc:content": ["Abstract:"],
        "vdoc:wide": true,
        "vdoc:tall": true,
      },
    },
    types: {
      ...summaryHeaders,
    },
    toolsets: {
      ...summaryHeaders,
    },
    tools: {
      ...summaryHeaders,
    },
    commands: {
      ...summaryHeaders,
      "header#8;description": {
        "vdoc:content": ["Description:"],
        "vdoc:wide": true,
      },
    },
    workspaces: {
      ...summaryHeaders,
      "header#1;version": "Version",
      "header#2;license": "License",
      "header#8;description": {
        "vdoc:content": ["Description:"],
        "vdoc:wide": true,
      },
    },
  },
};
