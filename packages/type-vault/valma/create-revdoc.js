#!/usr/bin/env vlm

exports.command = "create-revdoc [revdocName]";
exports.describe = "Create a revdoc source code file";
exports.introduction = `${exports.describe}.`;

exports.disabled = () => false;
exports.builder = (yargs) => yargs.options({
  title: {
    type: "string",
    description: "The dc:title of the document",
    interactive: { type: "input", when: "if-undefined" },
  },
  shortName: {
    type: "string",
    description: "The ReSpec short name of the document (defaults to revdoc-name / dir-name)",
    interactive: { type: "input", when: "if-undefined" },
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
  tutorial: {
    type: "boolean", default: true,
    description: "Add introduction chapter with respec tutorial references"
  },
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const revdocName = !yargv.revdocName ? "revdoc.js" : `${yargv.revdocName}.revdoc.js`;
  if (vlm.shell.test("-e", revdocName)) {
    throw new Error(`Cannot create revdoc '${revdocName}' which already exists`);
  }
  const source = _createReVDocSource({
    title: yargv.title,
    shortName: ((typeof yargv.shortName === "string") && yargv.shortName) ? yargv.shortName
        : yargv.revdocName || vlm.path.basename(process.cwd()),
    editors: yargv.editors || [],
    authors: yargv.authors || [],
    packageConfig: { valos: {}, ...(vlm.getPackageConfig() || {}) },
    chapters: yargv.tutorial ? _createTutorialIntroductionSource() : "",
  });
  if (!await vlm.inquireConfirm(
      `Confirm creation of revdoc source: ${vlm.theme.path(revdocName)}`)) {
    vlm.warn(`No revdoc file '${revdocName}'created:`, "user rejected confirmation.");
    return { success: false };
  }
  vlm.shell.ShellString(source).to(revdocName);
  vlm.instruct(`You can edit the revdoc document at:`, vlm.theme.path(revdocName));
  return { revdocName, success: true };
};

function _createReVDocSource ({ title, shortName, editors, authors, packageConfig, chapters }) {
  return `
const {
  extractee: { cdata, authors, ref, context, cli, command, cpath, bulleted, pkg },
} = require("@valos/revdoc");

module.exports = {
  "dc:title": "${title || ""}",
  respecConfig: {
    specStatus: "unofficial",
    editors: authors(${editors.map(editorName => `"${editorName}"`).join(", ")}),
    authors: authors(${authors.map(authorName => `"${authorName}"`).join(", ")}),
    shortName: "${shortName || ""}",
  },
  "chapter#abstract>0": [
    "This document is a revdoc template document '${shortName}' created by create-revdoc.",
  ],
  "chapter#sotd>1": [
    "This document is part of the ${packageConfig.valos.type} workspace ",
    ref("${packageConfig.name}"),
    " (of domain ", ref("${packageConfig.valos.domain}"), ") which is ",
    "${packageConfig.description}",
  ],
${chapters}};
`;
}

function _createTutorialIntroductionSource () {
return `  "chapter#introduction>2": [
    "Edit me - this is the first payload chapter. Abstract and SOTD are essential",
    ref("ReSpec boilerplate", "https://github.com/w3c/respec/wiki/ReSpec-Editor's-Guide#essential-w3c-boilerplate"),
    null,
    "See ", ref("ReVDoc tutorial", "@valos/revdoc/tutorial"),
    " for instructions on how to write revdoc source documents.",
    null,
    "See also ", ref("ReVdoc specification", "@valos/revdoc"),
    " and ", ref("VDoc specification", "@valos/vdoc"),
    " for reference documentation.",
  ],
`;
}
