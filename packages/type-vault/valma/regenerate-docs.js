exports.vlm = { toolset: "@valos/type-vault" };
exports.command = "regenerate-docs";
exports.describe = "Regenerate all configured /docs content";
exports.introduction = `${exports.describe}.

.`;

exports.disabled = (yargs) => (!yargs.vlm.getToolConfig(yargs.vlm.toolset, "docs", "inUse")
        ? "@valos/type-vault tool 'docs' is not configured to be inUse"
    : ((yargs.vlm.commandName === ".release-vault/.prepared-hooks/regenerate-docs")
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
  revdocs: {
    default: true,
    description: "Generate revdocs from all vault **/*revdoc.js files",
  },
  vdocld: {
    default: true,
    description: "Generate vdocld documents from all vault **/*revdoc.js files",
  },
});

exports.handler = async (yargv) => {
  const convert = require("xml-js");
  const patchWith = require("@valos/tools/patchWith").default;
  const { sbomTables, extractee: { ref, authors }, extension }
      = require("@valos/sbomdoc");

  const vlm = yargv.vlm;
  const config = vlm.getPackageConfig();
  const toolset = vlm.getToolsetConfig(exports.vlm.toolset);
  const vaultDocsConfig = vlm.getToolConfig("@valos/type-vault", "docs") || {};
  const docsBaseIRI = vaultDocsConfig.docsBaseIRI;

  vlm.shell.mkdir("-p", "docs");

  if (yargv.sbom) {
    await generateFormatsAndWriteToDocs();
  }

  if (yargv.revdocs) {
    const packageRevdocPaths = [...(vlm.shell.find("-l",
        "{revdocs,packages,opspaces,workers}/**/{*.,}revdoc.js") || [])];
    for (const revdocPath of packageRevdocPaths) {
      const [, workspaceBase, workspaceName, docDir,, docName] = revdocPath.match(
          /^(revdocs|packages\/|opspaces\/|workers\/)([^/]*)\/(.*\/)?(([^/]*)\.)?revdoc\.js/);
      let targetDocName = docName;
      const targetWorkspaceBase = (workspaceBase !== "packages/" && workspaceBase !== "revdocs")
          ? [workspaceBase] : [];
      let targetDocPath = vlm.path.join(...targetWorkspaceBase, workspaceName || ".", docDir || "");
      if (!targetDocName) {
        if (workspaceBase === "revdocs") {
          targetDocName = "index";
        } else {
          targetDocName = vlm.path.basename(targetDocPath);
          targetDocPath = vlm.path.join(targetDocPath, "..");
        }
      }
      if (docsBaseIRI && workspaceName) {
        await updateReVDocContainingPackagedocsBaseIRI(
            workspaceBase, workspaceName, targetWorkspaceBase);
      }
      await generateRevdocAndWriteToDocs(
          revdocPath, targetDocPath, targetDocName, yargv.vdocld);
    }
  }
  await vlm.execute("git add docs/*");
  return true;

  async function generateFormatsAndWriteToDocs () {
    const sbomxml = await scrapeCycloneDXXML();
    await vlm.shell.ShellString(sbomxml)
        .to("docs/sbom.cyclonedx.xml");
    const sbomvdocld = await extractVDocLD(sbomxml);
    await vlm.shell.ShellString(JSON.stringify(sbomvdocld, null, 2))
        .to("docs/sbom.vdocld");
    const sbomhtml = await emitHTML(sbomvdocld);
    await vlm.shell.ShellString(sbomhtml)
        .to("docs/sbom.html");
    const sbommarkdown = await emitMarkdown(sbomvdocld);
    await vlm.shell.ShellString(sbommarkdown)
        .to("docs/sbom.md");
    return { sbomxml, sbomvdocld, sbomhtml, sbommarkdown };
  }

  async function updateReVDocContainingPackagedocsBaseIRI (
      workspaceBase, workspaceName, targetWorkspaceBase) {
    const packageJSONPath = vlm.path.join(workspaceBase, workspaceName, "package.json");
    const packageJSONText = await vlm.tryReadFile(packageJSONPath);
    if (packageJSONText) {
      const packageJSON = JSON.parse(packageJSONText);
      if (packageJSON.valos && !packageJSON.valos.docs) {
        packageJSON.valos.docs = _combineIRI(docsBaseIRI, ...targetWorkspaceBase, workspaceName);
        if (!packageJSON.homepage) packageJSON.homepage = packageJSON.valos.docs;
        vlm.shell.ShellString(`${JSON.stringify(packageJSON, null, 2)}\n`)
            .to(packageJSONPath);
      }
    }
  }

  async function generateRevdocAndWriteToDocs (
      revdocPath, targetDocPath, targetDocName, emitReVDocLD) {
    const revdocSource = require(vlm.path.join(process.cwd(), revdocPath));
    const revdocld = extension.extract(revdocSource, {
      documentIRI: _combineIRI(docsBaseIRI, targetDocPath, targetDocName),
    });
    const revdocHTML = await emitHTML(revdocld);
    const targetDir = vlm.path.join("docs", targetDocPath);
    const targetFileName = `${targetDocName}.html`;
    await vlm.shell.mkdir("-p", targetDir);
    await vlm.shell.ShellString(revdocHTML)
        .to(vlm.path.join(targetDir, targetFileName));
    if (emitReVDocLD) {
      const vdocLDPath = vlm.path.join(targetDir, `${targetDocName}.vdocld`);
      await vlm.shell.ShellString(JSON.stringify(revdocld, null, 2))
          .to(vdocLDPath);
      vdocldListing.push(vdocLDPath);
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

  async function extractVDocLD (sbomxml) {
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
      "chapter#abstract>0": [
        "This document is an autogenerated", ref("CycloneDX", "https://cyclonedx.org/"),
        ref("SBoM document", `https://www.owasp.org/index.php/Component_Analysis#${
            ""}Software_Bill-of-Materials_.28SBOM.29`),
      ],
      "chapter#sotd>1": [
        "This document was automatically generated on", (new Date()).toISOString(), ".",
        null,
        "This SBoM document is available in following formats:",
        ref("CycloneDX XML", "sbom.cyclonedx.xml"), ",",
        ref("VDoc JSON-LD", "sbom.vdocld"), ",",
        ref("SBoM HTML", "sbom.html"), "and",
        ref("markdown", "sbom.md"), ".",
      ],
      "chapter#introduction>2": toolset.introduction || [
        `Configure @valos/type-vault-sbom.introduction section using`,
        ref("VDoc source graph syntax", "@valos/vdoc#source_graph"),
        "to define the content of this section."
      ],
      "chapter#>3;Components table": {
        "table#>0;components_data": sbomTables.components,
        "data#components_data": sbomgraph.bom.components,
      },
    };
    return extension.extract(sbomSource, { documentIRI: `${docsBaseIRI || ""}sbom` });
  }

  async function emitHTML (sbomvdocld) {
    const sbomhtml = extension.emit("", sbomvdocld, "html");
    return sbomhtml;
  }

  async function emitMarkdown (sbomvdocld) {
    const sbommarkdown = `# ${sbomvdocld[0]["dc:title"]}

Markdown VDoc extension not implemented yet.
`;
    return sbommarkdown;
  }
};
