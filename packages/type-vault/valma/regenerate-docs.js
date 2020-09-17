require("@babel/polyfill");
const { wrapError } = require("@valos/tools/wrapError");

exports.vlm = { toolset: "@valos/type-vault" };
exports.command = "regenerate-docs [name-pattern]";
exports.describe = "Regenerate all configured /docs content";
exports.introduction = ``;

exports.disabled = (yargs) => (!yargs.vlm.getToolConfig(yargs.vlm.toolset, "docs", "inUse")
        ? "@valos/type-vault tool 'docs' is not configured to be inUse"
    : ((yargs.vlm.contextCommand === ".release-vault/.assembled-hooks/regenerate-docs")
            && !yargs.vlm.getToolConfig(yargs.vlm.toolset, "docs", "regenerateOnRelease"))
        ? "@valos/type-vault tool 'docs' is not configured to be regenerated on release"
    : false);

exports.builder = (yargs) => yargs.options({
  summary: {
    type: "object", description: "Preparation summary",
  },
  sbom: {
    type: "boolean", default: true,
    description: "Generate Software Bill of Materials documents",
  },
  "assembly-root": {
    type: "string", default: "dist/packages",
    description: "Assembled package root directory to forward the regenerate call to",
  },
  revdocs: {
    type: "string", array: true, default: ["revdocs", "packages/", "opspaces/", "workers/"],
    description: "Folders to scan and generate revdocs from for all matching **/*revdoc*.js files",
  },
  stylesheets: {
    type: "string", array: true,
    default: [].concat(yargs.vlm.getToolConfig(yargs.vlm.toolset, "docs", "stylesheets") || []),
    description: "CSS directives to add to revdoc generation",
  },
  vdocstate: {
    default: true,
    description: "Generate VDocState documents from all vault **/*revdoc*.js files",
  },
  "listing-target": {
    type: "string", default: yargs.vlm.getToolConfig(yargs.vlm.toolset, "docs", "listingTarget"),
    description: "Target path for document listing",
  },
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  if (yargv["assembly-root"] && !yargv.alreadyForwarded) {
    const regenerateForwardPath = vlm.path.join(process.cwd(),
        yargv["assembly-root"], "@valos", "type-vault", "valma", "regenerate-docs");
    try {
      const packagedRegenerate = require(regenerateForwardPath);
      yargv.alreadyForwarded = true;
      return packagedRegenerate.handler(yargv);
    } catch (error) {
      vlm.warn("--assembly-root requested but no regenerate-docs forward found at:",
          vlm.theme.path(regenerateForwardPath));
    }
  }

  const convert = require("xml-js");
  const patchWith = require("@valos/tools/patchWith").default;
  const { sbomTables, extractee: { ref, authors }, extension } = require("@valos/sbomdoc");

  const config = vlm.getPackageConfig();
  const toolset = vlm.getToolsetConfig(exports.vlm.toolset);
  const vaultDocsConfig = vlm.getToolConfig("@valos/type-vault", "docs") || {};
  const docsBaseIRI = vaultDocsConfig.docsBaseIRI;
  const listing = {};
  function _addDocumentToListing (documentPath, vdocState, { tags = [], ...rest }) {
    listing[documentPath] = {
      "@id": vdocState[0]["@id"],
      tags: (vdocState[0]["VDoc:tags"] || []).concat(...tags)
          .filter((v, i, a) => a.indexOf(v) === i),
      subProfiles: (vdocState[0].subProfiles || []),
      title: vdocState[0]["dc:title"] || documentPath,
      ..._embedSection("abstract", vdocState[0].abstract),
      ..._embedSection("introduction",
          { ...vdocState[0].introduction || {}, "dc:title": undefined }),
      ..._embedSection("valospaceAbstract", vdocState[0].section_valospace_abstract),
      ..._embedSection("valosheathAbstract", vdocState[0].section_valosheath_abstract),
      ..._embedSection("fabricAbstract", vdocState[0].section_fabric_abstract),
      ...(vdocState[0]["VRevdoc:preferredPrefix"] && {
        "VRevdoc:preferredPrefix": vdocState[0]["VRevdoc:preferredPrefix"],
        "VRevdoc:baseIRI": vdocState[0]["VRevdoc:baseIRI"],
        "VRevdoc:referencedModules": vdocState[0]["VRevdoc:referencedModules"],
        "VRevdoc:extenderModules": vdocState[0]["VRevdoc:extenderModules"],
      }),
      ...rest,
    };
  }

  function _embedSection (target, source) {
    if (source === undefined) return {};
    const ret = { [target]: { ...source } };
    delete ret[target]["@id"];
    return ret;
  }

  vlm.shell.mkdir("-p", "docs");

  const namePattern = yargv["name-pattern"];

  if (!namePattern && yargv.sbom) {
    await generateFormatsAndWriteToDocs();
  }

  if (yargv.revdocs) {
    const scannedFolders = yargv.revdocs.map(e => e.replace("/", "\\/")).join("|");
    const revdocRegex = new RegExp(
        `^(${scannedFolders})([^/]*)\\/(.*\\/)?(([^/]*)\\.)?revdoc(.test)?\\.js`);
    const packageRevdocPaths = [...(vlm.shell.find("-l",
        `{${yargv.revdocs.map(e => e.replace("/", "")).join(",")}}/**/{,*.}revdoc{,.test}.js`)
            || [])];
    for (const revdocPath of packageRevdocPaths) {
      try {
        const [, workspaceBase, workspaceName, docDir,, docName] = revdocPath.match(revdocRegex);
        if (namePattern && !revdocPath.includes(namePattern)) continue;
        let targetDocName = docName;
        const targetWorkspaceBase = (workspaceBase !== "packages/" && workspaceBase !== "revdocs")
            ? [workspaceBase] : [];
        let targetDocPath = vlm.path.join(
            ...targetWorkspaceBase, workspaceName || ".", docDir || "");
        if (!targetDocName) {
          if (workspaceBase === "revdocs") {
            targetDocName = "index";
          } else {
            targetDocName = vlm.path.basename(targetDocPath);
            targetDocPath = vlm.path.join(targetDocPath, "..");
          }
        }
        let sourcePath = revdocPath;
        if (yargv["assembly-root"] && (workspaceBase === "packages/")) {
          const babelifiedPath = vlm.path.join(yargv["assembly-root"],
              config.valos.domain.match(/^([^/]*)/)[1], revdocPath.replace(/^packages\//, ""));
          if (vlm.shell.test("-f", vlm.path.join(process.cwd(), babelifiedPath))) {
            sourcePath = babelifiedPath;
          }
        }
        const packageJSONPath = !workspaceName ? "package.json"
            : vlm.path.join(workspaceBase, workspaceName, "package.json");
        const packageJSON = JSON.parse(await vlm.tryReadFile(packageJSONPath));
        if (docsBaseIRI && workspaceName) {
          await updateReVDocParentPackageValOSDocsBaseIRI(
              workspaceName, targetWorkspaceBase, packageJSON, packageJSONPath);
        }
        const { revdocState } = await generateRevdocAndWriteToDocs(
            sourcePath, targetDocPath, targetDocName, yargv.vdocstate);
        if (revdocState) {
          const documentName = targetDocName === "index"
              ? config.name
              : vlm.path.join(targetDocPath, targetDocName);
          _addDocumentToListing(documentName, revdocState, {
            package: packageJSON.name, version: packageJSON.version,
          });
        }
      } catch (error) {
        throw wrapError(error, new Error(`During vlm regenerate-docs`),
            "revdocPath:", revdocPath);
      }
    }
  }
  if (!namePattern && yargv["listing-target"]) {
    vlm.shell.ShellString(JSON.stringify(listing, null, 2))
        .to(vlm.path.join(process.cwd(), yargv["listing-target"]));
    await vlm.execute([`git add`, yargv["listing-target"]]);
  }
  await vlm.execute("git add docs/*");
  return true;

  async function generateFormatsAndWriteToDocs () {
    const sbomxml = await scrapeCycloneDXXML();
    await vlm.shell.ShellString(sbomxml)
        .to("docs/sbom.cyclonedx.xml");
    const sbomDocState = await extractVDocState(sbomxml);
    await vlm.shell.ShellString(JSON.stringify(sbomDocState, null, 2))
        .to("docs/sbom.jsonld");
    _addDocumentToListing("sbom", sbomDocState, {
      package: config.name, version: config.version, tags: ["PRIMARY", "SBOM"],
    });
    const sbomhtml = await emitHTML(sbomDocState);
    await vlm.shell.ShellString(sbomhtml)
        .to("docs/sbom.html");
    const sbommarkdown = await emitMarkdown(sbomDocState);
    await vlm.shell.ShellString(sbommarkdown)
        .to("docs/sbom.md");
    return { sbomxml, sbomDocState, sbomhtml, sbommarkdown };
  }

  async function updateReVDocParentPackageValOSDocsBaseIRI (
      workspaceName, targetWorkspaceBase, packageJSON, packageJSONPath) {
    if (packageJSON.valos && !packageJSON.valos.docs) {
      packageJSON.valos.docs = _combineIRI(docsBaseIRI, ...targetWorkspaceBase, workspaceName);
      if (!packageJSON.homepage) packageJSON.homepage = packageJSON.valos.docs;
      vlm.shell.ShellString(`${JSON.stringify(packageJSON, null, 2)}\n`)
          .to(packageJSONPath);
    }
  }

  async function generateRevdocAndWriteToDocs (
      revdocPath, targetDocPath, targetDocName, emitRevDocState) {
    try {
      const revdocSource = require(vlm.path.join(process.cwd(), revdocPath));
      const revdocState = extension.extract(revdocSource, {
        documentIRI: _combineIRI(docsBaseIRI, targetDocPath, targetDocName),
      });
      const referencedModules = revdocState[0]["VRevdoc:referencedModules"];
      if (referencedModules && yargv["assembly-root"]) {
        for (const [referencePrefix, referredModule] of Object.entries(referencedModules)) {
          const alternateModulePath =
              vlm.path.join(process.cwd(), yargv["assembly-root"], referredModule);
          if (vlm.shell.test("-f", vlm.path.join(alternateModulePath, "index.js"))
              || vlm.shell.test("-f", `${alternateModulePath}.js`)) {
            referencedModules[referencePrefix] = alternateModulePath;
          }
        }
      }
      vlm.ifVerbose(1).info("Regenerating revdoc at", vlm.theme.path(revdocPath));
      const revdocHTML = await emitHTML(revdocState);
      const targetDir = vlm.path.join("docs", targetDocPath);
      await vlm.shell.mkdir("-p", targetDir);
      const targetDocumentPath = vlm.path.join(targetDir, targetDocName);
      await vlm.shell.ShellString(revdocHTML)
          .to(`${targetDocumentPath}.html`);
      if (emitRevDocState) {
        await vlm.shell.ShellString(JSON.stringify(revdocState, null, 2))
            .to(`${targetDocumentPath}.jsonld`);
      }
      return { revdocState };
    } catch (error) {
      throw wrapError(error, new Error(`During generateRevdocAndWriteToDocs("${revdocPath}")`),
          "\n\ttargetDocPath:", targetDocPath,
          "\n\ttargetDocName:", targetDocName,
          "\n\temitReVDocState:", emitRevDocState);
    }
  }

  function _combineIRI (base, ...rest) {
    const tail = !base ? "" : base[base.length - 1];
    return `${!base ? "" : base.slice(0, -1)}${vlm.path.join(tail, ...rest)}`;
  }

  async function scrapeCycloneDXXML () {
    const sbomxml = await vlm.execute(`cyclonedx-bom -d`);
    return sbomxml;
  }

  async function extractVDocState (sbomxml) {
    const sbomgraph = patchWith({}, convert.xml2js(sbomxml, { compact: true, nativeType: true }), {
      preExtend (target, patch, key, targetObject) {
        if (patch == null || Array.isArray(patch)) return undefined;
        const flatten = (patch._text !== undefined) ? patch._text
            : (patch._cdata !== undefined) ? patch._cdata
            : (patch.id !== undefined) ? patch.id
            : (patch.license || patch.component) !== undefined
                ? [].concat(patch.license || patch.component)
            : undefined;
        if (flatten !== undefined) {
          const ret = this.extend(undefined, flatten);
          if (key === "licenses") return ret.join(",");
          return ret;
        }
        if (key === "_attributes") {
          this.extend(targetObject, patch);
          return null;
        }
        return undefined;
      },
      postExtend (tgt) {
        return (tgt !== null) ? tgt : undefined;
      },
    });
    const sbomSource = {
      "dc:title": `${config.name}@${config.version} Software Bill of Materials`,
      respecConfig: {
        specStatus: "unofficial",
        editors: authors(...Object.keys(vaultDocsConfig.authors || {})),
        shortName: "sbom",
      },
      "chapter#abstract>0": {
        "#0": [
`This document is an autogenerated `, ref("CycloneDX", "https://cyclonedx.org/"), ` `,
ref("SBoM document", `https://www.owasp.org/index.php/Component_Analysis#${
    ""}Software_Bill-of-Materials_.28SBOM.29`),
        ],
      },
      "chapter#sotd>1": {
        "#0": [
`This document was automatically generated on `, (new Date()).toISOString(), `.

This SBoM document is available in following formats: `,
ref("CycloneDX XML", "sbom.cyclonedx.xml"), `, `, ref("VDoc JSON-LD", "sbom.jsonld"), `, `,
ref("SBoM HTML", "sbom.html"), ` and `, ref("markdown", "sbom.md"), `.`,
        ],
      },
      "chapter#introduction>2": toolset.introduction || {
        "#0": [
`Configure @valos/type-vault-sbom.introduction section using`,
ref("VDoc source graph syntax", "@valos/vdoc#source_graph"), `
to define the content of this section.`,
        ],
      },
      "chapter#>3;Components table": {
        "table#>0;components_data": sbomTables.components,
        "data#components_data": sbomgraph.bom.components,
      },
    };
    return extension.extract(sbomSource, { documentIRI: `${docsBaseIRI || ""}sbom` });
  }

  async function emitHTML (vdocState) {
    const sbomhtml = extension.emit(vdocState, "html", {
      revdoc: { stylesheets: yargv.stylesheets },
      logger: vlm,
    });
    return sbomhtml;
  }

  async function emitMarkdown (sbomDocState) {
    const sbommarkdown = `# ${sbomDocState[0]["dc:title"]}

Markdown VDoc extension not implemented yet.
`;
    return sbommarkdown;
  }
};
