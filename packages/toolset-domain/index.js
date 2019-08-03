const { extractee: { ref } } = require("@valos/revdoc");

const documentHeaders = {
  "header#0": {
    "vdoc:cellContent": ref("vdoc:selectKey", "vdoc:selectKey", { style: "font-weight: bold" }),
    "vdoc:content": ["Name"],
  },
  /*
  "header#0": {
    "vdoc:cellContent": { a: "vdoc:TemplateSelector",
      "vdoc:content": ["vdoc:selectKey"],
      "vdoc:ref": "vdoc:ref",
    },
    "vdoc:content": ["id"],
  },
  */
  "header#1;package": "Package",
  "header#2;version": "Version",
  "header#3": {
    "vdoc:cellContent": { "vdoc:words": { "vdoc:selectField": "tags" } },
    "vdoc:content": ["Tags"],
  },
  "header#8;title": {
    "vdoc:content": ["Title:"],
    "vdoc:layout": "vdoc:wide",
  },
};
const summaryHeaders = {
  "header#0": {
    "vdoc:cellContent": ref("vdoc:selectKey", "vdoc:selectKey", { style: "font-weight: bold" }),
    "vdoc:content": ["Name"],
  },
  "header#9;introduction": {
    "vdoc:content": ["Introduction:"],
    "vdoc:layout": "vdoc:wide",
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
        "vdoc:layout": ["vdoc:wide", "vdoc:tall"],
      },
    },
    apiReferenceDocuments: {
      ...documentHeaders,
      "header#9;apiAbstract": {
        "vdoc:content": ["API abstract:"],
        "vdoc:layout": ["vdoc:wide", "vdoc:tall"],
      },
    },
    ontologyDocuments: {
      ...documentHeaders,
      "header#9;ontologyAbstract": {
        "vdoc:content": ["Ontology abstract:"],
        "vdoc:layout": ["vdoc:wide", "vdoc:tall"],
      },
    },
    primaryDocuments: {
      ...documentHeaders,
      "header#9;abstract": {
        "vdoc:content": ["Abstract:"],
        "vdoc:layout": ["vdoc:wide", "vdoc:tall"],
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
        "vdoc:layout": "vdoc:wide",
      },
    },
    workspaces: {
      ...summaryHeaders,
      "header#1;version": "Version",
      "header#2;license": "License",
      "header#8;description": {
        "vdoc:content": ["Description:"],
        "vdoc:layout": "vdoc:wide",
      },
    },
  },
};
