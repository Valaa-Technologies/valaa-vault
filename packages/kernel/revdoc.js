
const {
  extractee: {
    authors, em, identifize, pkg, ref,
    filterKeysWithAnyOf, filterKeysWithAllOf, filterKeysWithNoneOf,
    valosRaemFieldClasses,
  },
  ontologyColumns, revdocOntologyProperties,
} = require("@valos/revdoc");
const { domainColumns } = require("@valos/type-vault");

const { name, version, repository } = require("./package");
const { summary, documents } = require("./index");

const { workspaces, types, toolsets, tools, commands } = summary;

const {
  VKernel: {
    preferredPrefix, baseIRI, description: namespaceDescription,
    prefixes, context, referencedModules, vocabulary,
  } = { vocabulary: {} },
  ...remainingOntology
} = require("./ontology");

const roleDocuments = filterKeysWithAllOf("tags", ["PRIMARY", "ROLE"], documents);
const introductionDocuments = filterKeysWithAllOf("tags", ["PRIMARY", "INTRODUCTORY"], documents);
const valospaceDocuments = filterKeysWithAllOf("tags", ["PRIMARY", "VALOSPACE"], documents);
const valosheathDocuments = filterKeysWithAllOf("tags", ["PRIMARY", "VALOSHEATH"], documents);
const fabricDocuments = filterKeysWithAllOf("tags", ["PRIMARY", "FABRIC"], documents);
const otherPrimaryDocuments = filterKeysWithAllOf("tags", "PRIMARY", documents)
    .filter(key => !roleDocuments.includes(key)
        && !introductionDocuments.includes(key)
        && !valospaceDocuments.includes(key)
        && !valosheathDocuments.includes(key)
        && !fabricDocuments.includes(key));

module.exports = {
  "dc:title": `${name} domain content reference`,
  "VDoc:tags": ["PRIMARY", "DOMAIN", "ONTOLOGY", "TECHNICIAN"],
  "VRevdoc:package": name,
  "VRevdoc:version": version,
  "VRevdoc:preferredPrefix": preferredPrefix,
  "VRevdoc:baseIRI": baseIRI,
  ...revdocOntologyProperties({ prefixes, context, referencedModules }, remainingOntology),

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

  "chapter#abstract>0": {
    "#0": [
`${name} domain  includes all core infrastructure components of ValOS -
the Valaa Open System.

These components are hosted at the `, ref("npmjs repository within @valos namespace",
    "https://www.npmjs.com/search?q=%40valos"), `.

These components are developed at the `, ref("valos git repository", repository), `.`,
    ],
  },
  "chapter#sotd>1": {
    "#0": [
`This document is part of the vault workspace `, pkg(name), `
(of domain `, pkg(name), `) which has the description:
\`ValOS common infrastructure tools and libraries monorepo\`.`,
    ],
  },
  "chapter#introduction>2": {
    "dc:title": em(`"Greetings, I am Valma, the ValOS Mediator. Who are you?"`),
    "#0": [
`ValOS ecosystem revolves around various roles. This document is
a reference document of the ValOS fabric systems and structures
and is directed for technicians. Check out the brief
description and introductions of the other roles as well.

`, ref("Valma"), ` itself is a collection of tools for interacting
with the ValOS ecosystem, most notable of which is `,
ref([em("vlm"), ` the command line script invoker`], "@/valma"), `.`,
    ],
    "table#>0;documents": {
      "VDoc:columns": domainColumns.roles,
      "VDoc:entries": roleDocuments,
    },
  },
  "chapter#section_documentation>3;Primary documentation": {
    "#0": [
`This domain provides the following primary documents:`,
    ],
    "chapter#section_introduction_documents>0;Introduction documents": {
      "#0": [],
      "table#>0;documents": {
        "VDoc:columns": domainColumns.introductionDocuments,
        "VDoc:entries": introductionDocuments,
      },
    },
    "chapter#section_valospace_documents>1;Valospace documents": {
      "#0": [],
      "table#>0;documents": {
        "VDoc:columns": domainColumns.valospaceDocuments,
        "VDoc:entries": valospaceDocuments,
      },
    },
    "chapter#section_valosheath_documents>1;Valosheath documents": {
      "#0": [],
      "table#>0;documents": {
        "VDoc:columns": domainColumns.valosheathDocuments,
        "VDoc:entries": valosheathDocuments,
      },
    },
    "chapter#section_ontology_documents>2;Fabric documents": {
      "#0": [],
      "table#>0;documents": {
        "VDoc:columns": domainColumns.fabricDocuments,
        "VDoc:entries": fabricDocuments,
      },
    },
    "chapter#section_other_primary_documents>3;Other primary documents": {
      "#0": [],
      "table#>0;documents": {
        "VDoc:columns": domainColumns.primaryDocuments,
        "VDoc:entries": otherPrimaryDocuments,
      },
    },
  },
  "chapter#section_workspaces>4;Workspaces": {
    "#0": [
`This domain introduces the following `, ref("workspaces", "@/valma#workspace"),
` and workspace infrastructure components.`,
    ],
    [`chapter#section_new_types>0;Workspace types, ${Object.keys(types).length} new`]: {
      "#0": [
        `This domain introduces the following `, ref("workspace types", "@/valma#type"), ".",
      ],
      "table#>0;types": domainColumns.types,
    },
    [`chapter#section_new_toolsets>1;Workspace toolsets, ${
        Object.keys(toolsets).length} new`]: {
      "#0": [
        `This domain introduces the following `, ref("workspace toolsets", "@/valma#toolset"), ":",
      ],
      "table#>0;toolsets": domainColumns.toolsets,
    },
    [`chapter#section_new_tools>2;Workspace tools, ${Object.keys(tools).length} new`]: {
      "#0": [
        `This domain introduces the following `, ref("workspace tools", "@/valma#tool"), ":",
      ],
      "table#>0;tools": domainColumns.tools,
    },
    [`chapter#section_new_commands>3;Valma commands, ${Object.keys(commands).length} new`]: {
      "#0": [
        `This domain introduces the following top-level `,
        ref("valma commands", "@/valma#command"), ":",
      ],
      "table#>0;commands": domainColumns.commands,
    },
    ...Object.entries(workspaces).map(([type, typeWorkspaces], index) => ({
      [`chapter#section_new_${identifize(type)}_workspaces>${4 + index
          };Type '${type}' workspaces, ${Object.keys(typeWorkspaces).length} new`]: {
        "#0": [
(types[type] || {}).introduction || `

This domain introduces the following `, type, ` `, ref("workspaces", "@/valma#workspace"), `.`,
        ],
        [`data#${identifize(type)}_workspaces`]: typeWorkspaces,
        [`table#>0;${identifize(type)}_workspaces`]: domainColumns.workspaces,
        /*
        ...Object.entries(subWorkspaces).map(([name, entry]) => ({
          [`chapter#${identifize(name)}>${index};${name}`]: {
            [`table#>0;${identifize(name)}_workspaces`]: domainColumns.workspaces,
          }
        })).reduce((a, t) => Object.assign(a, t), {}),
        */
      },
    })).reduce((a, t) => Object.assign(a, t), {}),
  },
  [`chapter#section_fabric>8;${name} domain root ontology`]: {
    "#section_fabric_abstract>0": [namespaceDescription || ""],
    "#0": [
`All labels have implicit IRI prefix "${baseIRI}" (with preferred
prefix "${preferredPrefix}:")`,
    ],
    "chapter#section_prefixes>1": {
      "dc:title": [em(preferredPrefix), ` IRI prefixes`],
      "#0": [],
      "table#>0;prefixes": ontologyColumns.prefixes,
    },
    "chapter#section_classes>2": {
      "dc:title": [em(preferredPrefix), " ", ref("fabric classes", "VKernel:Class")],
      "#0": [],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.classes,
        "VDoc:entries": filterKeysWithAnyOf("@type", "VKernel:Class", vocabulary),
      },
    },
    "chapter#section_properties>3": {
      "dc:title": [em(preferredPrefix), " ", ref("fabric properties", "VKernel:Property")],
      "#0": [],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.properties,
        "VDoc:entries": filterKeysWithAnyOf("@type", "VKernel:Property", vocabulary),
      },
    },
    "chapter#section_types>4": {
      "dc:title": [em(preferredPrefix), " ", ref("valospace resource types", "VModel:Type")],
      "#0": [],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.types,
        "VDoc:entries": filterKeysWithAnyOf("@type", "VModel:Type", vocabulary),
      },
    },
    "chapter#section_fields>5": {
      "dc:title": [em(preferredPrefix), " ", ref("valospace fields", "VModel:Field")],
      "#0": [],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.fields,
        "VDoc:entries": filterKeysWithAnyOf("@type", valosRaemFieldClasses, vocabulary),
      },
    },
    "chapter#section_resolvers>6": {
      "dc:title": [em(preferredPrefix), " ", ref("field resolvers", "VValk:Resolver")],
      "#0": [],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.verbs,
        "VDoc:entries": filterKeysWithAnyOf("@type", "VValk:Resolver", vocabulary),
      },
    },
    "chapter#section_vocabulary_other>8": {
      "dc:title": [em(preferredPrefix), ` remaining vocabulary`],
      "#0": [],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.vocabularyOther,
        "VDoc:entries": filterKeysWithNoneOf("@type", [
          "VKernel:Class", "VKernel:Property",
          "VState:Type", ...valosRaemFieldClasses, "VValk:Resolver",
        ], vocabulary),
      },
    },
    [`chapter#section_context>9;JSON-LD context term definitions`]: {
      "#0": [],
      "table#>0;context": ontologyColumns.context,
    },
  },
  "chapter#section_hierarchy>9;Component hierarchy": {
    "#0": [
`This section will contain hierarchical presentation of all above
components (and more).`,
    ]
  },
};
