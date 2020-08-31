const { extractee: { ref, em, strong } } = require("@valos/revdoc");

const documents = {
  "header#0": {
    "VDoc:cell": strong(ref("VDoc:selectKey")),
    "VDoc:content": ["Name"],
  },
  /*
  "header#0": {
    "VDoc:cell": { "@type": "VDoc:TemplateSelector",
      "VDoc:content": ["VDoc:selectKey"],
      "VDoc:ref": "VDoc:ref",
    },
    "VDoc:content": ["id"],
  },
  */
  "header#1;package": "Package",
  "header#2;version": "Version",
  "header#3": {
    "VDoc:cell": { "VDoc:words": { "VDoc:selectField": "tags" } },
    "VDoc:content": ["Tags"],
  },
};

const titledDocuments = {
  ...documents,
  "header#8;title": {
    "VDoc:content": em("Title:"),
    "VDoc:wide": true,
  },
};

const roles =  {
  "header#0": {
    "VDoc:cell": strong(ref("VDoc:selectKey")),
    "VDoc:content": ["Your role:"],
  },
  "header#1": {
    "VDoc:cell": strong(em(
        ref({ "VDoc:selectField": "title" }, ["VDoc:selectKey", "#introduction"]))),
    "VDoc:content": ["Your answer..."],
  },
  "header#8;introduction": {
    "VDoc:content": em("Introduction:"),
    "VDoc:wide": true,
    "VDoc:tall": true,
  },
  "header#9": {
    "VDoc:content": em("Aliases:"),
    "VDoc:wide": true,
    "VDoc:cell": em(ref(
        { "VDoc:words": { "VDoc:selectField": "subProfiles" } },
        ["VDoc:selectKey", "#section_profiles"])),
  },
};

const introductionDocuments =  {
  ...documents,
  "header#8": {
    "VDoc:content": em("Title:"),
    "VDoc:cell": ref({ "VDoc:selectField": "title" }, ["VDoc:selectKey", "#introduction"]),
    "VDoc:wide": true,
  },
  "header#9;introduction": {
    "VDoc:content": em("Introduction:"),
    "VDoc:wide": true,
    "VDoc:tall": true,
  },
};

const apiReferenceDocuments = {
  ...documents,
  "header#8": {
    "VDoc:content": em("Title:"),
    "VDoc:cell": ref({ "VDoc:selectField": "title" }, ["VDoc:selectKey", "#apiAbstract"]),
    "VDoc:wide": true,
  },
  "header#9;apiAbstract": {
    "VDoc:content": em("API abstract:"),
    "VDoc:wide": true,
    "VDoc:tall": true,
  },
};

const ontologyDocuments = {
  ...documents,
  "header#8": {
    "VDoc:content": em("Title:"),
    "VDoc:cell": ref({ "VDoc:selectField": "title" }, ["VDoc:selectKey", "#ontology"]),
    "VDoc:wide": true,
  },
  "header#9;ontologyAbstract": {
    "VDoc:content": em("Ontology abstract:"),
    "VDoc:wide": true,
    "VDoc:tall": true,
  },
};

const primaryDocuments = {
  ...documents,
  "header#8": {
    "VDoc:content": em("Title:"),
    "VDoc:cell": ref({ "VDoc:selectField": "title" }, ["VDoc:selectKey", "#abstract"]),
    "VDoc:wide": true,
  },
  "header#9;abstract": {
    "VDoc:content": em("Abstract:"),
    "VDoc:wide": true,
    "VDoc:tall": true,
  },
};

const summary = {
  "header#0": {
    "VDoc:cell": strong(ref("VDoc:selectKey")),
    "VDoc:content": ["Name"],
  },
  "header#9;introduction": {
    "VDoc:content": em("Introduction:"),
    "VDoc:wide": true,
  },
};

const commandSourced = {
  ...summary,
  "header#1;package": "Package",
  "header#2;version": "Version",
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
  "header#8;description": {
    "VDoc:content": em("Description:"),
    "VDoc:wide": true,
  },
};

const workspaces = {
  ...summary,
  "header#1;version": "Version",
  "header#2;license": "License",
  "header#8;description": {
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
