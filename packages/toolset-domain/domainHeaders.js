const { extractee: { ref, em, strong } } = require("@valos/revdoc");

const documents = {
  "header#0": {
    "vdoc:cell": strong(ref("vdoc:selectKey")),
    "vdoc:content": ["Name"],
  },
  /*
  "header#0": {
    "vdoc:cell": { "@type": "vdoc:TemplateSelector",
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
};

const titledDocuments = {
  ...documents,
  "header#8;title": {
    "vdoc:content": em("Title:"),
    "vdoc:wide": true,
  },
}

const roles =  {
  "header#0": {
    "vdoc:cell": strong(ref("vdoc:selectKey")),
    "vdoc:content": ["Your role:"],
  },
  "header#1": {
    "vdoc:cell": strong(em(
        ref({ "vdoc:selectField": "title" }, ["vdoc:selectKey", "#introduction"]))),
    "vdoc:content": ["Your answer..."],
  },
  "header#8;introduction": {
    "vdoc:content": em("Introduction:"),
    "vdoc:wide": true,
    "vdoc:tall": true,
  },
  "header#9": {
    "vdoc:content": em("Aliases:"),
    "vdoc:wide": true,
    "vdoc:cell": em(ref(
        { "vdoc:words": { "vdoc:selectField": "subProfiles" } },
        ["vdoc:selectKey", "#section_profiles"])),
  },
};

const introductionDocuments =  {
  ...documents,
  "header#8": {
    "vdoc:content": em("Title:"),
    "vdoc:cell": ref({ "vdoc:selectField": "title" }, ["vdoc:selectKey", "#introduction"]),
    "vdoc:wide": true,
  },
  "header#9;introduction": {
    "vdoc:content": em("Introduction:"),
    "vdoc:wide": true,
    "vdoc:tall": true,
  },
};

const apiReferenceDocuments = {
  ...documents,
  "header#8": {
    "vdoc:content": em("Title:"),
    "vdoc:cell": ref({ "vdoc:selectField": "title" }, ["vdoc:selectKey", "#apiAbstract"]),
    "vdoc:wide": true,
  },
  "header#9;apiAbstract": {
    "vdoc:content": em("API abstract:"),
    "vdoc:wide": true,
    "vdoc:tall": true,
  },
};

const ontologyDocuments = {
  ...documents,
  "header#8": {
    "vdoc:content": em("Title:"),
    "vdoc:cell": ref({ "vdoc:selectField": "title" }, ["vdoc:selectKey", "#ontology"]),
    "vdoc:wide": true,
  },
  "header#9;ontologyAbstract": {
    "vdoc:content": em("Ontology abstract:"),
    "vdoc:wide": true,
    "vdoc:tall": true,
  },
};

const primaryDocuments = {
  ...documents,
  "header#8": {
    "vdoc:content": em("Title:"),
    "vdoc:cell": ref({ "vdoc:selectField": "title" }, ["vdoc:selectKey", "#abstract"]),
    "vdoc:wide": true,
  },
  "header#9;abstract": {
    "vdoc:content": em("Abstract:"),
    "vdoc:wide": true,
    "vdoc:tall": true,
  },
};

const summary = {
  "header#0": {
    "vdoc:cell": strong(ref("vdoc:selectKey")),
    "vdoc:content": ["Name"],
  },
  "header#9;introduction": {
    "vdoc:content": em("Introduction:"),
    "vdoc:wide": true,
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
    "vdoc:content": em("Description:"),
    "vdoc:wide": true,
  },
};

const workspaces = {
  ...summary,
  "header#1;version": "Version",
  "header#2;license": "License",
  "header#8;description": {
    "vdoc:content": em("Description:"),
    "vdoc:wide": true,
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
