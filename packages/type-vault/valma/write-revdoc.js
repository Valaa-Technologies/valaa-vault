#!/usr/bin/env vlm

exports.command = "write-revdoc [revdocName]";
exports.describe = "Write a new revdoc source code file";
exports.introduction = ``;

exports.disabled = () => false;
exports.builder = (yargs) => yargs.options({
  title: {
    type: "string",
    description: "The dc:title of the document",
    interactive: { type: "input", when: "if-undefined" },
  },
  "short-name": {
    type: "string",
    description: "The ReSpec short name of the document (defaults to revdoc-name / dir-name)",
    interactive: { type: "input", when: "if-undefined" },
  },
  testdoc: {
    type: "boolean",
    description: "Add testdoc bindings (with '-revdoc.test.js' suffix)",
  },
  workspace: {
    type: "boolean",
    description: "Add workspace root document bindings.",
    causes: ["no-title", "no-short-name", "tags=WORKSPACE"],
  },
  valospace: {
    type: "any",
    description:
`Add a section for a valospace ontology namespace.
Optionally a string value refers to a specific ontology-module export.`,
    causes: ["tags=VALOSPACE", "tags=ONTOLOGY"],
  },
  valosheath: {
    type: "any",
    description:
`Add a section for a valosheath ontology namespace.
Optionally a string value refers to a specific ontology-module export.`,
    causes: ["tags=VALOSHEATH", "tags=ONTOLOGY"],
  },
  fabric: {
    type: "any",
    description:
`Add a section for a fabric ontology namespace.
Optionally a string value refers to a specific ontology-module export.`,
    causes: ["tags=FABRIC", "tags=ONTOLOGY"],
  },
  tags: {
    type: "string", array: true,
    description: "List of VDoc:tags to add to the document module exports",
  },
  editors: {
    type: "string", array: true,
    description: "The revdoc editors' names as specified in type-vault.tools.docs.authors",
    interactive: { type: "input", when: "if-undefined" },
  },
  authors: {
    type: "string", array: true,
    description: "The revdoc authors' names as listed in type-vault.tools.docs.authors",
    interactive: { type: "input", when: "if-undefined" },
  },
  abstract: {
    type: "boolean", default: true,
    description: "Add the abstract section",
  },
  sotd: {
    type: "boolean", default: true,
    description: "Add the Status Of This Document section",
  },
  tutorial: {
    type: "boolean", default: true,
    description: "Add introduction chapter with respec tutorial references"
  },
  "ontology-module": {
    type: "string",
    description:
`Name or relative path to the ontology specification module.
Defaults to package.json sibling ontology.js`,
  },
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const revdocName = [
    yargv.revdocName, "revdoc", yargv.testdoc && "test", "js",
  ].filter(e => e).join(".");
  if (vlm.shell.test("-e", revdocName)) {
    throw new Error(`Cannot create revdoc '${revdocName}' which already exists`);
  }
  const revdocOptions = {
    vlm,
    title: yargv.title,
    shortName: yargv["short-name"] || yargv.revdocName || vlm.path.basename(process.cwd()),
    editors: yargv.editors || [],
    authors: yargv.authors || [],
    packageConfig: { valos: {}, ...(vlm.getPackageConfig() || {}) },
    tags: Object.fromEntries((yargv.tags || []).map(tag => [tag, true])),
    moduleExports: [],
    respecConfigs: [],
    isWorkspaceDoc: yargv.workspace,
    isTestDoc: yargv.testdoc,
    ontologyModule: yargv["ontology-module"],
    fabricNamespace: yargv.fabric,
    valospaceNamespace: yargv.valospace,
    revdocImports: [],
    extractees: [],
    headers: [],
    chapters: [],
    footers: [],
  };

  _prepareRespecConfigs(revdocOptions);
  if (yargv.testdoc) _enableTestDoc(revdocOptions);

  const sectionNames = [];
  for (const [yargvFlag, createSection] of [
    ["abstract", _createAbstractSection],
    ["sotd", _createSOTDSection],
    ["tutorial", _createTutorialIntroductionSource],
    ["valospace", _createValospaceOntologySection],
    ["valosheath", _createValosheathOntologySection],
    ["fabric", _createFabricOntologySection],
  ]) {
    if (yargv[yargvFlag]) {
      sectionNames.push(yargvFlag);
      revdocOptions.chapters.push(createSection(revdocOptions));
    }
  }
  const source = _createReVDocSource(revdocOptions);

  if (!await vlm.inquireConfirm(
      `Confirm creation of revdoc source with sections ${sectionNames}: ${
          vlm.theme.path(revdocName)}`)) {
    vlm.warn(`No revdoc file '${revdocName}' created:`, "user rejected confirmation.");
    return { success: false };
  }

  vlm.shell.ShellString(source).to(revdocName);
  vlm.instruct(`You can edit the revdoc document at:`, vlm.theme.path(revdocName));
  return { revdocName, success: true };
};

function _createReVDocSource ({
  revdocImports, extractees, headers, tags, moduleExports, respecConfigs, chapters, footers,
}) {
  return `
const {${revdocImports.filter(n => n).join("")}
  extractee: {
    c, em, ref, cli, command, cpath, bulleted,
    authors, pkg,${extractees.filter(n => n).join("")}
  },
} = require("@valos/revdoc");
${headers.filter(n => n).join("")}

module.exports = {${!Object.keys(tags).length ? "" : `
  "VDoc:tags": ["${Object.keys(tags).join(`", "`)}"],`
  }${moduleExports.filter(n => n).join("")}
  respecConfig: {${respecConfigs.filter(n => n).join("")}
  },${chapters.filter(n => n).join("")}
};${footers.filter(n => n).join("")}
`;
}

function _prepareRespecConfigs (revdocOptions) {
  const {
    vlm, title, headers, shortName, editors, authors, moduleExports, respecConfigs,
    isWorkspaceDoc, isOntologyDoc, valospaceNamespace, fabricNamespace,
  } = revdocOptions;
  let packageJSON;
  if (!revdocOptions.packageDir) revdocOptions.packageDir = ".";
  do {
    try {
      packageJSON = require(vlm.path.join(vlm.cwd, revdocOptions.packageDir, "package"));
    } catch (error) {
      if (vlm.path.join(vlm.cwd, revdocOptions.packageDir).length <= 1) {
        throw new Error(`Can't require workspace package.json from any parent directory`);
      }
      revdocOptions.packageDir = `${revdocOptions.packageDir}/..`;
    }
  } while (!packageJSON);
  const titleText = title ? `"${title}"`
      : isWorkspaceDoc ? `\`\${name} \${type} workspace\``
      : valospaceNamespace ?  `\`The valospace '${isOntologyDoc}' namespace reference\``
      : fabricNamespace ?  `\`The fabric '${isOntologyDoc}' namespace reference\``
      : `\`Workspace \${name} document ${shortName}\``;

  headers.push(`
const { name, version, description, valos: { type } = {} } = require("${
    revdocOptions.packageDir}/package");

const title = ${titleText};`);
  moduleExports.push(`
  "dc:title": title,
  "VRevdoc:package": name,
  "VRevdoc:version": version,`);
  respecConfigs.push(`
    specStatus: "unofficial",
    shortName: "${shortName || ""}",
    editors: authors(${editors.map(editorName => `"${editorName}"`).join(", ")}),
    authors: authors(${authors.map(authorName => `"${authorName}"`).join(", ")}),`);
}

function _enableTestDoc ({ extractees, headers, footers }) {
  extractees.push(`
    prepareTestDoc,`);
  headers.push(`
const { itExpects, runTestDoc } = prepareTestDoc(title);`);
  footers.push(`
runTestDoc();`);
}

function _createAbstractSection ({ shortName, isWorkspaceDoc }) {
  return `
  "chapter#abstract>0": {
    "#0": [
${!isWorkspaceDoc
        ?
`\`This document is a revdoc template document '${shortName}' created by
write-revdoc.\`,`
        :
"      description,"}
    ],
  },`;
}

function _createSOTDSection ({ packageConfig }) {
  return `
  "chapter#sotd>1": {
    "#0": [
\`This document is part of the ${packageConfig.valos.type} workspace \`, pkg("${
  packageConfig.name}"), \`
(of domain \`, pkg("${packageConfig.valos.domain}"), \`) which has the description:
\\\`\${description}\\\`.\`,
    ],
  },`;
}

function _createTutorialIntroductionSource (revdocOptions, isTestDoc) {
  return `
  "chapter#introduction>2": {
    "#0": [
\`Edit me - this is the first payload chapter. Abstract and SOTD are
essential \`, ref("ReSpec boilerplate",
    "https://github.com/w3c/respec/wiki/ReSpec-Editor's-Guide#essential-w3c-boilerplate"), \`

See \`, ref("ReVDoc tutorial", "@valos/revdoc/tutorial"), \` for
instructions on how to write revdoc source documents.

See also \`, ref("ReVdoc specification", "@valos/revdoc"), \` and \`,
ref("VDoc specification", "@valos/vdoc"), \` for reference documentation.\`,
    ],
  ${!isTestDoc ? "" :
  `  "example#1": itExpects("trivial testdoc test",
        () => ({ value: 10 }),
        "toEqual",
        { value: 10 }),
  `}},`;
}

function _createValospaceOntologySection (revdocOptions) {
  return _createOntologySection(revdocOptions, {
    kind: "valospace",
    namespace: revdocOptions.valospaceNamespace,
    chapterIndex: "7",
    class: "VModel:Type",
    property: "VModel:Field",
    // method: "VEngine:Method",
    // globals: "VEngine:Global",
  });
}

function _createValosheathOntologySection (revdocOptions) {
  return _createOntologySection(revdocOptions, {
    kind: "valosheath",
    namespace: revdocOptions.valospaceNamespace,
    chapterIndex: "8",
    class: "VEngine:Class",
    property: "VEngine:Property",
    method: "VEngine:Method",
    globals: "VEngine:Global",
  });
}

function _createFabricOntologySection (revdocOptions) {
  return _createOntologySection(revdocOptions, {
    kind: "fabric",
    namespace: revdocOptions.fabricNamespace,
    chapterIndex: "9",
    class: "VKernel:Class",
    property: "VKernel:Property",
    method: "VEngine:Method",
    globals: "VEngine:Global",
  });
}

function _createOntologySection (revdocOptions, names) {
  if (!revdocOptions.ontologyModule) {
    revdocOptions.ontologyModule =
        `./${revdocOptions.vlm.path.join(revdocOptions.packageDir, "ontology")}`;
  }
  const {
    vlm, revdocImports, extractees, headers, tags, moduleExports, ontologyModule,
  } = revdocOptions;
  if (names.namespace === true) {
    const ontology = require(vlm.path.join(vlm.cwd, ontologyModule));
    const namespaceNames = Object.keys(ontology);
    if (namespaceNames.length !== 1) {
      throw new Error(`--${names.kind}=true requested but ontology module "${
        ontologyModule}" exports ${namespaceNames.length
        } namespaces. Provide explicit ontology name with --${names.kind}=<name>`);
    }
    names.namespace = namespaceNames[0];
  }
  revdocImports.push(`
  ontologyColumns, revdocOntologyProperties, `);
  extractees.push(`
    filterKeysWithAnyOf, filterKeysWithNoneOf, valosRaemFieldClasses,`);
  headers.push(`
const {
  ${names.namespace}: {
    preferredPrefix, baseIRI, description: namespaceDescription,
    prefixes, context, referencedModules, vocabulary, extractionRules,
  },
  ...remainingOntology
} = require("${ontologyModule}");`);
  tags.ONTOLOGY = true;
  moduleExports.unshift(`
  "@context": {
    ...prefixes,
    ...context,
  },
`);
  moduleExports.push(`
  "VRevdoc:preferredPrefix": preferredPrefix,
  "VRevdoc:baseIRI": baseIRI,
  ...revdocOntologyProperties({ prefixes, context, referencedModules }, remainingOntology),
`);

  names.all = [names.class, names.property, names.method, names.globals];
  return `
  "chapter#section_${names.kind}>${names.chapterIndex}": {
    "dc:title": [
      "The ", em(preferredPrefix), " ${names.kind
          } namespace of the library ontology of ", pkg(name),
    ],
    "data#prefixes": prefixes,
    "data#vocabulary": vocabulary,
    "data#context": context,
    "#section_${names.kind}_abstract>0": [
      namespaceDescription || "",
    ],
    "chapter#section_prefixes>1": {
      "dc:title": [em(name), " IRI prefixes"],
      "#0": [],
      "table#>0;prefixes": ontologyColumns.prefixes,
    },${_createClassesSection(names.kind === "valospace" ? "types" : "classes")
    }${_createPropertiesSection(names.kind === "valospace" ? "fields" : "properties")
    }${_createMethodsSection()
    }${_createGlobalsSection()
    }
    "chapter#section_vocabulary_other>8": {
      "dc:title": [em(preferredPrefix), " remaining vocabulary terms"],
      "#0": [],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.vocabularyOther,
        "VDoc:entries": filterKeysWithNoneOf("@type", [
          ${names.all.map(n => `"${n}",`).join(" ")}
        ], vocabulary),
      },
    },
  },
`;
  function _createClassesSection (kind = "classes") {
    return !names.class ? "" : `
    "chapter#section_${kind}>2": {
      "dc:title": [em(preferredPrefix), " ", ref("${names.kind} ${kind}", "${names.class}")],
      "#0": [
"This section describes ${names.kind} ${kind} introduced by the '${names.namespace}' namespace",
      ],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.${kind},
        "VDoc:entries": filterKeysWithAnyOf("@type", "${names.class}", vocabulary),
      },
    },`;
  }
  function _createPropertiesSection (kind = "properties") {
    return !names.property ? "" : `
    "chapter#section_${kind}>3": {
      "dc:title": [em(preferredPrefix), " ", ref("${names.kind} ${kind}", "${names.property}")],
      "#0": [
"This section describes ${names.kind} ${kind} introduced by the '${names.namespace}' namespace",
      ],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.${kind},
        "VDoc:entries": filterKeysWithAnyOf("@type", "${names.property}", vocabulary),
      },
    },`;
  }
  function _createMethodsSection () {
    return !names.method ? "" : `
    "chapter#section_methods>4": {
      "dc:title": [
        em(preferredPrefix), " ", ref("${names.kind} methods", "${names.method}"),
      ],
      "#0": [
"This section describes ${names.kind} methods introduced by the '${names.namespace}' namespace",
      ],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.methods,
        "VDoc:entries": filterKeysWithAnyOf("@type", "${names.method}", vocabulary),
      },
    }`;
  }
  function _createGlobalsSection () {
    return !names.globals ? "" : `
    "chapter#section_globals>5": {
      "dc:title": [
        em(preferredPrefix), " ", ref("${names.kind} globals", "${names.globals}"),
      ],
      "#0": [
"This section describes ${names.kind} global objects introduced by the '${
    names.namespace}' namespace",
      ],
      "table#>0;vocabulary": {
        "VDoc:columns": ontologyColumns.globals,
        "VDoc:entries": filterKeysWithAnyOf("@type", "${names.globals}", vocabulary),
      },
    },`;
  }
}
