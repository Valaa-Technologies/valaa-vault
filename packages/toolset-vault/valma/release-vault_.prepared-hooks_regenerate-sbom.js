exports.vlm = { toolset: "@valos/toolset-vault-sbom" };
exports.command = ".release-vault/.prepared-hooks/regenerate-sbom";
exports.describe = "Generate software bill of materials summary on vault (pre)release";
exports.introduction = `${exports.describe}.`;

exports.disabled = (yargs) =>
    (!yargs.vlm.getToolsetConfig(yargs.vlm.toolset, "inUse")
        ? "@valos/toolset-vault-sbom is not configured to be inUse"
    : !yargs.vlm.getToolsetConfig(yargs.vlm.toolset, "commands",
            ".configure/.type/.vault/.selectable/@valos/toolset-vault-sbom", "release-regenerate")
        && "release-regenerate not enabled in @valos/toolset-vault-sbom config");

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
});

exports.handler = async (yargv) => {
  const convert = require("xml-js");
  const patchWith = require("@valos/tools/patchWith").default;
  const { extract, ontologyTables, extractee: { ref } } = require("@valos/toolset-vault/sbomdoc");
  const { emit, extractee: { authors } } = require("@valos/toolset-vault/revdoc");

  const vlm = yargv.vlm;
  const config = vlm.getPackageConfig();
  const toolset = vlm.getToolsetConfig(exports.vlm.toolset);
  const vaultToolsetReVDoc = vlm.getToolsetConfig("@valos/toolset-vault", "revdoc") || {};
  const docsBaseURI = vaultToolsetReVDoc.docsBaseURI;

  vlm.shell.mkdir("-p", "docs");

  if (yargv.sbom) {
    await generateFormatsAndWriteToDocs();
  }

  if (yargv.revdocs) {
    const packageRevdocPaths = [...(vlm.shell.find("-l",
        "{packages,autholleries,workers}/**/{*.,}revdoc.js") || [])];
    for (const revdocPath of packageRevdocPaths) {
      const [, workspaceBase, workspaceName, docDir,, docName] = revdocPath
          .match(/^(packages|autholleries|workers)\/([^/]*)\/(.*\/)?(([^/]*)\.)?revdoc\.js/);
      let targetDocName = docName;
      const targetWorkspaceBase = (workspaceBase !== "packages") ? [workspaceBase] : [];
      let targetDocPath = vlm.path.join(...targetWorkspaceBase, workspaceName, docDir || "");
      if (!targetDocName) {
        targetDocName = vlm.path.basename(targetDocPath);
        targetDocPath = vlm.path.join(targetDocPath, "..");
      }
      if (docsBaseURI) {
        await updateReVDocContainingPackageDocsBaseURI(
            workspaceBase, workspaceName, targetWorkspaceBase);
      }
      await generateRevdocAndWriteToDocs(
          revdocPath, targetDocPath, targetDocName, yargv.revdocs === "vdocson");
    }
  }
  await vlm.execute("git add docs/*");
  return true;

  async function generateFormatsAndWriteToDocs () {
    const sbomxml = await scrapeCycloneDXXML();
    await vlm.shell.ShellString(sbomxml)
        .to("docs/sbom.cyclonedx.xml");
    const sbomvdocson = await extractVDocSON(sbomxml);
    await vlm.shell.ShellString(JSON.stringify(sbomvdocson, null, 2))
        .to("docs/sbom.vdoc.jsonld");
    const sbomhtml = await emitHTML(sbomvdocson);
    await vlm.shell.ShellString(sbomhtml)
        .to("docs/sbom.html");
    const sbommarkdown = await emitMarkdown(sbomvdocson);
    await vlm.shell.ShellString(sbommarkdown)
        .to("docs/sbom.md");
    return { sbomxml, sbomvdocson, sbomhtml, sbommarkdown };
  }

  async function updateReVDocContainingPackageDocsBaseURI (
      workspaceBase, workspaceName, targetWorkspaceBase) {
    const packageJSONPath = vlm.path.join(workspaceBase, workspaceName, "package.json");
    const packageJSONText = await vlm.tryReadFile(packageJSONPath);
    if (packageJSONText) {
      const packageJSON = JSON.parse(packageJSONText);
      if (packageJSON.valos && !packageJSON.valos.docs) {
        packageJSON.valos.docs = vlm.path.join(
            docsBaseURI, ...targetWorkspaceBase, workspaceName);
        vlm.shell.ShellString(`${JSON.stringify(packageJSON, null, 2)}\n`)
            .to(packageJSONPath);
      }
    }
  }

  async function generateRevdocAndWriteToDocs (
      revdocPath, targetDocPath, targetDocName, emitReVDocSON) {
    const revdocSource = require(vlm.path.join(process.cwd(), revdocPath));
    const revdocson = extract(
        vlm.path.join(docsBaseURI || "", targetDocPath, targetDocName),
        revdocSource);
    const revdocHTML = await emitHTML(revdocson);
    const targetDir = vlm.path.join("docs", targetDocPath);
    const targetFileName = `${targetDocName}.html`;
    await vlm.shell.mkdir("-p", targetDir);
    await vlm.shell.ShellString(revdocHTML)
        .to(vlm.path.join(targetDir, targetFileName));
    if (emitReVDocSON) {
      await vlm.shell.ShellString(JSON.stringify(revdocson, null, 2))
          .to(vlm.path.join(targetDir, `${targetDocName}.jsonld`));
    }
  }

  async function scrapeCycloneDXXML () {
    const sbomxml = await vlm.execute(`cyclonedx-bom -d`);
    return sbomxml;
  }

  async function extractVDocSON (sbomxml) {
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
    const sbomvdocson = extract(`${docsBaseURI || ""}sbom`, {
      "vdoc:title": `${config.name}@${config.version} Software Bill of Materials`,
      respecConfig: {
        specStatus: "unofficial",
        editors: authors(...Object.keys(vaultToolsetReVDoc.authors || {})),
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
        ref("VDoc JSON-LD", "sbom.vdoc.jsonld"), ",",
        ref("SBoM HTML", "sbom.html"), "and",
        ref("markdown", "sbom.md"), ".",
      ],
      "chapter#introduction>2": toolset.introduction || [
        `Configure @valos/toolset-vault-sbom.introduction section using`,
        ref("VDoc source graph syntax",
            "https://valaatech.github.io/vault/toolset-vault/vdoc#source_graph"),
        "to define the content of this section."
      ],
      "chapter#>3;Components table": {
        "table#>0;components_data": ontologyTables.components,
        "data#components_data": sbomgraph.bom.components,
      },
    });
    return sbomvdocson;
  }

  async function emitHTML (sbomvdocson) {
    const sbomhtml = emit("", sbomvdocson, "html");
    return sbomhtml;
  }

  async function emitMarkdown (sbomvdocson) {
    const sbommarkdown = `# ${sbomvdocson[0]["vdoc:title"]}

Markdown VDoc extension not implemented yet.
`;
    return sbommarkdown;
  }
};
