const { extractee: { em, heading, ref, strong } } = require("@valos/revdoc");

const documents = {
  "column#00": {
    "VDoc:content": ["Name"],
    "VDoc:cell": strong(ref("VDoc:selectKey")),
  },
  /*
  "column#00": {
    "VDoc:cell": { "@type": "VDoc:TemplateSelector",
      "VDoc:content": ["VDoc:selectKey"],
      "VDoc:ref": "VDoc:ref",
    },
    "VDoc:content": ["id"],
  },
  */
  "column#01;package": "Package",
  "column#02;version": "Version",
  "column#03": {
    "VDoc:content": ["Tags"],
    "VDoc:cell": { "VDoc:words": { "VDoc:selectField": "tags" } },
  },
};

const titledDocuments = {
  ...documents,
  "column#08;title": {
    "VDoc:content": em("Title:"),
    "VDoc:wide": true,
  },
};

const roles =  {
  "column#00": {
    "VDoc:content": ["Your role:"],
    "VDoc:cell": heading(strong(ref("VDoc:selectKey"))),
  },
  "column#01": {
    "VDoc:content": ["Your answer..."],
    "VDoc:cell": strong(em(
        ref({ "VDoc:selectField": "title" }, ["VDoc:selectKey", "#introduction"]))),
  },
  "column#08;introduction": {
    "VDoc:content": em("Introduction:"),
    "VDoc:wide": true,
    "VDoc:tall": true,
  },
  "column#09": {
    "VDoc:content": em("Aliases:"),
    "VDoc:wide": true,
    "VDoc:cell": em(ref(
        { "VDoc:words": { "VDoc:selectField": "subProfiles" } },
        ["VDoc:selectKey", "#section_profiles"])),
  },
};

const introductionDocuments =  {
  ...documents,
  "column#08": {
    "VDoc:content": em("Title:"),
    "VDoc:cell": ref({ "VDoc:selectField": "title" }, ["VDoc:selectKey", "#introduction"]),
    "VDoc:wide": true,
  },
  "column#09;introduction": {
    "VDoc:content": em("Introduction:"),
    "VDoc:wide": true,
    "VDoc:tall": true,
  },
};

const apiReferenceDocuments = {
  ...documents,
  "column#08": {
    "VDoc:content": em("Title:"),
    "VDoc:cell": ref({ "VDoc:selectField": "title" }, ["VDoc:selectKey", "#apiAbstract"]),
    "VDoc:wide": true,
  },
  "column#09;apiAbstract": {
    "VDoc:content": em("API abstract:"),
    "VDoc:wide": true,
    "VDoc:tall": true,
  },
};

const ontologyDocuments = {
  ...documents,
  "column#08": {
    "VDoc:content": em("Title:"),
    "VDoc:cell": ref({ "VDoc:selectField": "title" }, ["VDoc:selectKey", "#ontology"]),
    "VDoc:wide": true,
  },
  "column#09;ontologyAbstract": {
    "VDoc:content": em("Ontology abstract:"),
    "VDoc:wide": true,
    "VDoc:tall": true,
  },
};

const primaryDocuments = {
  ...documents,
  "column#8": {
    "VDoc:content": em("Title:"),
    "VDoc:cell": ref({ "VDoc:selectField": "title" }, ["VDoc:selectKey", "#abstract"]),
    "VDoc:wide": true,
  },
  "column#9;abstract": {
    "VDoc:content": em("Abstract:"),
    "VDoc:wide": true,
    "VDoc:tall": true,
  },
};

const summary = {
  "column#00": {
    "VDoc:cell": strong(ref("VDoc:selectKey")),
    "VDoc:content": ["Name"],
  },
  "column#09;introduction": {
    "VDoc:content": em("Introduction:"),
    "VDoc:wide": true,
  },
};

const commandSourced = {
  ...summary,
  "column#01;package": "Package",
  "column#02;version": "Version",
};

const types = {
  ...commandSourced,
};

const toolsets = {
  ...commandSourced,
};

const tools = {
  ...commandSourced,
};

const commands = {
  ...summary,
  "column#08;description": {
    "VDoc:content": em("Description:"),
    "VDoc:wide": true,
  },
};

const workspaces = {
  ...summary,
  "column#01;version": "Version",
  "column#02;license": "License",
  "column#08;description": {
    "VDoc:content": em("Description:"),
    "VDoc:wide": true,
  },
};

module.exports = {
  roles,
  documents: titledDocuments,
  introductionDocuments,
  apiReferenceDocuments,
  ontologyDocuments,
  primaryDocuments,
  summary,
  commandSourced,
  types,
  toolsets,
  tools,
  commands,
  workspaces,
};
