
const {
  headers: revdocHeaders,
  extractee: {
    authors, ref, identifize, filterKeysWithAnyOf, filterKeysWithAllOf, filterKeysWithNoneOf,
  },
} = require("@valos/revdoc");
const { headers: domainHeaders } = require("@valos/toolset-domain");

const { name, version, repository } = require("../package");
const documents = require("./documents-summary") || {};

const { workspaces, types, toolsets, tools, commands } = require("./domain-summary");
const { prefix, prefixIRI, prefixes, vocabulary, context } = require("./ontology");

const introductionDocuments = filterKeysWithAllOf("tags", ["PRIMARY", "INTRO"], documents);
const apiReferenceDocuments = filterKeysWithAllOf("tags", ["PRIMARY", "API"], documents);
const ontologyDocuments = filterKeysWithAllOf("tags", ["PRIMARY", "ONTOLOGY"], documents);
const otherPrimaryDocuments = filterKeysWithAllOf("tags", "PRIMARY", documents)
    .filter(key => !introductionDocuments.includes(key)
        && !apiReferenceDocuments.includes(key)
        && !ontologyDocuments.includes(key));

module.exports = {
  "dc:title": `${name} domain content reference`,
  "vdoc:tags": ["PRIMARY", "DOMAIN", "ONTOLOGY"],
  "revdoc:package": name,
  "revdoc:prefix": prefix,
  "revdoc:prefixIRI": prefixIRI,
  "revdoc:version": version,
  respecConfig: {
    subtitle: version,
    specStatus: "unofficial",
    editors: authors("iridian"),
    authors: authors(),
    shortName: "valosKernelDomain",
  },
  "data#documents": documents,
  "data#workspaces": workspaces,
  "data#types": types,
  "data#toolsets": toolsets,
  "data#tools": tools,
  "data#commands": commands,
  "data#prefixes": prefixes,
  "data#vocabulary": vocabulary,
  "data#context": context,

  "chapter#abstract>0": [
    `${name} domain `,
    `includes all core infrastructure components of ValOS - the Valaa Open System.`,
    null,
    `These components are hosted at the `,
    ref("npmjs repository within @valos namespace", "https://www.npmjs.com/search?q=%40valos"), ".",
    null,
    `These components are developed at the `, ref("valos git repository", repository), ".",
  ],
  "chapter#sotd>1": [
    "This document is part of the vault workspace ", ref(name),
    " (of domain ", ref(name), ") which is ",
    "ValOS common infrastructure tools and libraries monorepo.",
  ],
  "chapter#introduction>2": [
    "No content yet.",
  ],
  "chapter#section_documentation>3;Documentation": {
    "#0": [
      `This domain provides the following primary documents:`,
    ],
    "chapter#section_introduction_documents>0;Introduction documents": {
      "#0": [],
      "table#>0;documents": {
        "vdoc:headers": domainHeaders.introductionDocuments,
        "vdoc:entries": introductionDocuments,
      },
    },
    "chapter#section_api_reference_documents>1;API reference documents": {
      "#0": [],
      "table#>0;documents": {
        "vdoc:headers": domainHeaders.apiReferenceDocuments,
        "vdoc:entries": apiReferenceDocuments,
      },
    },
    "chapter#section_ontology_documents>2;Ontology documents": {
      "#0": [],
      "table#>0;documents": {
        "vdoc:headers": domainHeaders.ontologyDocuments,
        "vdoc:entries": ontologyDocuments,
      },
    },
    "chapter#section_other_primary_documents>3;Other primary documents": {
      "#0": [],
      "table#>0;documents": {
        "vdoc:headers": domainHeaders.primaryDocuments,
        "vdoc:entries": otherPrimaryDocuments,
      },
    },
  },
  "chapter#section_workspaces>4;Workspaces": {
    "#0": [
      `This domain introduces the following `, ref("workspaces", "@/valma#workspace"),
      ` and workspace infrastructure components.`,
    ],
    [`chapter#section_workspace_types>0;Workspace types, ${Object.keys(types).length} new`]: {
      "#0": [
        `This domain introduces the following `, ref("workspace types", "@/valma#type"), ".",
      ],
      "table#>0;types": domainHeaders.types,
    },
    [`chapter#section_workspace_toolsets>1;Workspace toolsets, ${
        Object.keys(toolsets).length} new`]: {
      "#0": [
        `This domain introduces the following `, ref("workspace toolsets", "@/valma#toolset"), ":",
      ],
      "table#>0;toolsets": domainHeaders.toolsets,
    },
    [`chapter#section_workspace_tools>2;Workspace tools, ${Object.keys(tools).length} new`]: {
      "#0": [
        `This domain introduces the following `, ref("workspace tools", "@/valma#tool"), ":",
      ],
      "table#>0;tools": domainHeaders.tools,
    },
    [`chapter#section_workspace_commands>3;Valma commands, ${Object.keys(commands).length} new`]: {
      "#0": [
        `This domain introduces the following top-level `,
        ref("valma commands", "@/valma#command"), ":",
      ],
      "table#>0;commands": domainHeaders.commands,
    },
    ...Object.entries(workspaces).map(([type, typeWorkspaces], index) => ({
      [`chapter#section_${identifize(type)}_workspaces>${4 + index};Type '${type}' workspaces, ${
          Object.keys(typeWorkspaces).length} new`]: {
        "#0": [
          (types[type] || {}).introduction || "",
          null,
          `This domain introduces the following `, type, " ",
          ref("workspaces", "@/valma#workspace"), ".",
        ],
        [`data#${identifize(type)}_workspaces`]: typeWorkspaces,
        [`table#>0;${identifize(type)}_workspaces`]: domainHeaders.workspaces,
        /*
        ...Object.entries(subWorkspaces).map(([name, entry]) => ({
          [`chapter#${identifize(name)}>${index};${name}`]: {
            [`table#>0;${identifize(name)}_workspaces`]: domainHeaders.workspaces,
          }
        })).reduce((a, t) => Object.assign(a, t), {}),
        */
      },
    })).reduce((a, t) => Object.assign(a, t), {}),
  },
  [`chapter#ontology>8;${name} domain root ontology`]: {
    "#0": [
      `All labels have implicit prefix IRI "${prefixIRI}" (typically
      abbreviated as prefix "${prefix}:")`,
    ],
    [`chapter#section_prefixes>0;IRI prefixes`]: {
      "#0": [],
      "table#>0;prefixes": revdocHeaders.prefixes,
    },
    [`chapter#section_classes>1;rdfs:Class vocabulary`]: {
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": revdocHeaders.classes,
        "vdoc:entries": filterKeysWithAnyOf("a", "rdfs:Class", vocabulary),
      },
    },
    [`chapter#section_properties>2;rdf:Property vocabulary`]: {
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": revdocHeaders.properties,
        "vdoc:entries": filterKeysWithAnyOf("a", "rdf:Property", vocabulary),
      },
    },
    [`chapter#section_vocabulary_rest>3;Rest of the vocabulary`]: {
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": revdocHeaders.vocabulary,
        "vdoc:entries": filterKeysWithNoneOf("a", ["rdfs:Class", "rdf:Property"], vocabulary),
      },
    },
    [`chapter#section_context>4;JSON-LD context term definitions`]: {
      "#0": [],
      "table#>0;context": revdocHeaders.context,
    },
  },
  "chapter#section_hierarchy>9;Component hierarchy": {
    "#0": [
      `This section will contain hierarchical presentation of all above
      components (and more).`,
    ]
  },
};
