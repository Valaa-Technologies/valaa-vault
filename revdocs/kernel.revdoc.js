
const {
  extractee: {
    authors, em, identifize, pkg, ref,
    filterKeysWithAnyOf, filterKeysWithAllOf, filterKeysWithNoneOf,
  },
  ontologyHeaders,
} = require("@valos/revdoc");
const { domainHeaders } = require("@valos/type-vault");

const { name, version, repository } = require("../package");
const { summary, ontologies, documents } = require("../packages/kernel");

const { workspaces, types, toolsets, tools, commands } = summary;

const {
  "valos-kernel": { prefix, prefixIRI, prefixes, vocabulary, context },
} = ontologies;

const roleDocuments = filterKeysWithAllOf("tags", ["PRIMARY", "ROLE"], documents);
const introductionDocuments = filterKeysWithAllOf("tags", ["PRIMARY", "INTRODUCTORY"], documents);
const apiReferenceDocuments = filterKeysWithAllOf("tags", ["PRIMARY", "API"], documents);
const ontologyDocuments = filterKeysWithAllOf("tags", ["PRIMARY", "ONTOLOGY"], documents);
const otherPrimaryDocuments = filterKeysWithAllOf("tags", "PRIMARY", documents)
    .filter(key => !roleDocuments.includes(key)
        && !introductionDocuments.includes(key)
        && !apiReferenceDocuments.includes(key)
        && !ontologyDocuments.includes(key));

module.exports = {
  "dc:title": `${name} domain content reference`,
  "vdoc:tags": ["PRIMARY", "DOMAIN", "ONTOLOGY", "TECHNICIAN"],
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
    "This document is part of the vault workspace ", pkg(name),
    " (of domain ", pkg(name), ") which is ",
    "ValOS common infrastructure tools and libraries monorepo.",
  ],
  "chapter#introduction>2": {
    "dc:title": em(`"Greetings, I am Valma, the ValOS Mediator. Who are you?"`),
    "#0": [
      `ValOS ecosystem revolves around various roles. This document is
      a reference document of the ValOS fabric systems and structures
      and is directed for technicians. Check out the brief
      description and introductions of the other roles as well.`,
      null,
      ref("Valma"), ` itself is a collection of tools for interacting
      with the ValOS ecosystem, most notable of which is `,
      ref([em("vlm"), ` the command line script invoker`], "@/valma"),
      ".",
    ],
    "table#>0;documents": {
      "vdoc:headers": domainHeaders.roles,
      "vdoc:entries": roleDocuments,
    },
  },
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
    [`chapter#section_new_types>0;Workspace types, ${Object.keys(types).length} new`]: {
      "#0": [
        `This domain introduces the following `, ref("workspace types", "@/valma#type"), ".",
      ],
      "table#>0;types": domainHeaders.types,
    },
    [`chapter#section_new_toolsets>1;Workspace toolsets, ${
        Object.keys(toolsets).length} new`]: {
      "#0": [
        `This domain introduces the following `, ref("workspace toolsets", "@/valma#toolset"), ":",
      ],
      "table#>0;toolsets": domainHeaders.toolsets,
    },
    [`chapter#section_new_tools>2;Workspace tools, ${Object.keys(tools).length} new`]: {
      "#0": [
        `This domain introduces the following `, ref("workspace tools", "@/valma#tool"), ":",
      ],
      "table#>0;tools": domainHeaders.tools,
    },
    [`chapter#section_new_commands>3;Valma commands, ${Object.keys(commands).length} new`]: {
      "#0": [
        `This domain introduces the following top-level `,
        ref("valma commands", "@/valma#command"), ":",
      ],
      "table#>0;commands": domainHeaders.commands,
    },
    ...Object.entries(workspaces).map(([type, typeWorkspaces], index) => ({
      [`chapter#section_new_${identifize(type)}_workspaces>${4 + index
          };Type '${type}' workspaces, ${Object.keys(typeWorkspaces).length} new`]: {
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
    "#section_ontology_abstract>0": [
      `@valos/kernel ontology provides vocabulary and definitions of
      the ValOS core concepts.`
    ],
    "#0": [
      `All labels have implicit prefix IRI "${prefixIRI}" (typically
      abbreviated as prefix "${prefix}:")`,
    ],
    [`chapter#section_prefixes>1;IRI prefixes`]: {
      "#0": [],
      "table#>0;prefixes": ontologyHeaders.prefixes,
    },
    [`chapter#section_classes>2;<em>${prefix}:* a valos-kernel:Class</em> vocabulary`]: {
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": ontologyHeaders.classes,
        "vdoc:entries": filterKeysWithAnyOf("@type", "valos-kernel:Class", vocabulary),
      },
    },
    [`chapter#section_properties>3;<em>${prefix}:* a valos-kernel:Property</em> vocabulary`]: {
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": ontologyHeaders.properties,
        "vdoc:entries": filterKeysWithAnyOf("@type", "valos-kernel:Property", vocabulary),
      },
    },
    [`chapter#section_types>4;<em>${prefix}:* a valos-raem:Type</em> vocabulary`]: {
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": ontologyHeaders.types,
        "vdoc:entries": filterKeysWithAnyOf("@type", "valos-raem:Type", vocabulary),
      },
    },
    [`chapter#section_fields>5;<em>${prefix}:* a valos-raem:Field</em> vocabulary`]: {
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": ontologyHeaders.fields,
        "vdoc:entries": filterKeysWithAnyOf("@type", [
          "valos-raem:Field",
          "valos-raem:ExpressedField", "valos-raem:EventLoggedField", "valos-raem:CoupledField",
          "valos-raem:GeneratedField", "valos-raem:TransientField", "valos-raem:AliasField",
        ], vocabulary),
      },
    },
    [`chapter#section_vocabulary_other>8;<em>${prefix}:</em> other vocabulary`]: {
      "#0": [],
      "table#>0;vocabulary": {
        "vdoc:headers": ontologyHeaders.vocabularyOther,
        "vdoc:entries": filterKeysWithNoneOf("@type", [
          "valos-kernel:Class", "valos-kernel:Property",
          "valos-raem:Type", "valos-raem:Field", "valos-raem:Resolver",
          "valos-raem:ExpressedField", "valos-raem:EventLoggedField", "valos-raem:CoupledField",
          "valos-raem:GeneratedField", "valos-raem:TransientField", "valos-raem:AliasField",
        ], vocabulary),
      },
    },
    [`chapter#section_context>9;JSON-LD context term definitions`]: {
      "#0": [],
      "table#>0;context": ontologyHeaders.context,
    },
  },
  "chapter#section_hierarchy>9;Component hierarchy": {
    "#0": [
      `This section will contain hierarchical presentation of all above
      components (and more).`,
    ]
  },
};
