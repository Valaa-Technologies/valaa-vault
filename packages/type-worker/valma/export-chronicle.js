#!/usr/bin/env vlm

exports.command = "export-chronicle chronicle-uri [target-dir]";
exports.brief = "export chronicle as files";
exports.describe = "Exports given chronicle as file hierarchy under target directory";
exports.introduction = `Uses perspire.`;

exports.disabled = (yargs) => !yargs.vlm.getPackageConfig();
exports.builder = (yargs) => yargs.options({
  revelation: {
    type: "object", default: null,
    description: `Direct revelation object forwarded to perspire worker`
  },
  "job-view": {
    type: "object", default: null,
    description: `Job view configuration object (see Gateway.addView). Notably:
\tview.name: lookup key to revelation views
\tview.focus: the view focus valos URI`
  },
  "bvob-buffers": {
    type: "boolean", default: false,
    description: `Export ~$V.bvobBuffers.json bundle`,
  },
});

let _hacklm;
let _valosheath;

exports.handler = (yargv) => {
  if (!_valosheath) {
    _valosheath = require("@valos/gateway-api/valos").default;
    _valosheath.exportSpindle({
      name: "@valos/valma-export-chronicle-spindle",

      async onViewAttached (view, viewName) {
        view.warnEvent("attached and seen by spindle:", this.name, "as", viewName);
      },

      async runJob (view /* , journal */) {
        view.warnEvent("job entry");
        const vlm = _hacklm;
        const vRoot = view.getFocus();
        if (vRoot !== vRoot.step("chronicleRoot")) {
          throw new Error("chronicle-uri refers to non-root resource");
        }
        const exportOptions = view.getViewConfig().exportChronicleOptions;
        if (!exportOptions || !exportOptions.targetDir) {
          throw new Error("INTERNAL ERROR: exportChronicleOptions.targetDir view config missing");
        }
        const expate = { // EXPort stATE
          vlm,
          view,
          chronicleURI: vRoot.getVRef().getChronicleURI(),
          targetDir: exportOptions.targetDir,
          bvobInfos: {},
          bvobBuffers: exportOptions.bvobBuffers ? {} : undefined,
          product: {},
        };
        const rootRestate = { // root REsource STATE
          vResource: vRoot,
          vgrid: vRoot.getRawId(),
          dirParts: [],
        };
        await _exportVLog(expate);
        await _exportResourceDirectory(expate, rootRestate);
        await _exportBvobInfos(expate);
        await _exportBvobBuffers(expate);
        return expate.product;
      },
    });
  }

  _hacklm = yargv.vlm;
  const chronicleId = yargv["chronicle-uri"].match(/\?id=(.*)$/)[1];
  return yargv.vlm.invoke("perspire", [{
    ...(yargv.revelation ? { revelation: yargv.revelation } : {}),
    attach: true,
    "job-view": {
      focus: yargv["chronicle-uri"],
      lens: "disabled",
      ...(yargv["job-view"] || {}),
      exportChronicleOptions: {
        targetDir: (yargv["target-dir"] !== undefined)
            ? yargv["target-dir"]
            : chronicleId.slice(1, -2),
        bvobBuffers: yargv["bvob-buffers"],
      },
    },
    "job-spindle": "@valos/valma-export-chronicle-spindle",
  }]);
};

const { base64URLFromBuffer } = require("@valos/gateway-api/base64");

async function _exportVLog (expate) {
  const scribeConnection = expate.view.getGateway().scribe.getActiveConnection(expate.chronicleURI);
  const events = await scribeConnection._readTruths();
  expate.vlm.shell.mkdir("-p", expate.targetDir);
  const vlogPath = expate.vlm.path.join(expate.targetDir, "~$V.log.json");
  await expate.vlm.writeFile(vlogPath, `[
${events.map(event => {
  const { type, aspects, ...rest } = event;
  return JSON.stringify({ type, aspects, ...rest });
}).join(",\n")}
]`, "utf8");
  expate.product.chronicleInfosEntry = {
    name: scribeConnection.getChronicleName() || scribeConnection.getName(),
    authorityURI: scribeConnection.getAuthorityURI(),
    truthCount: events.length,
  };
  expate.product.chronicleVLogsEntry = { truthLog: { "!!!": _addDotSlashIfRelative(vlogPath) } };
  return vlogPath;
}

function _addDotSlashIfRelative (maybeRelativePath) {
  return (maybeRelativePath[0] === "/") ? maybeRelativePath : `./${maybeRelativePath}`;
}

async function _exportBvobInfos (expate) {
  const bvobInfosPath = expate.vlm.path.join(expate.targetDir, "~$V.bvobInfos.json");
  await expate.vlm.writeFile(bvobInfosPath, `{
${Object.entries(expate.bvobInfos).map(([key, value]) =>
    `${JSON.stringify(key)}:${JSON.stringify(value)}`).join(",\n")}
}`);
  expate.product.bvobInfosEntry = { "!!!": _addDotSlashIfRelative(bvobInfosPath) };
}

async function _exportBvobBuffers (expate) {
  if (!expate.bvobBuffers) return;
  const bvobBuffersPath = expate.vlm.path.join(expate.targetDir, "~$V.bvobBuffers.json");
  await expate.vlm.writeFile(bvobBuffersPath, `{
    ${Object.entries(expate.bvobBuffers).map(([key, value]) =>
        `${JSON.stringify(key)}:${JSON.stringify(value)}`).join(",\n")}
    }`);
  expate.product.bvobBuffersEntry = { "!!!": _addDotSlashIfRelative(bvobBuffersPath) };
}

async function _exportResourceDirectory (expate, restate, { skipIfEmpty } = {}) {
  const state = await restate.vResource.doValoscript(`({
    properties: Object.getOwnPropertyDescriptors(this),
    medias: this.$V.medias,
    relations: this.$V.relations,
    entities: this.$V.entities,
  })`);
  if (skipIfEmpty
      && !state.medias.length && !state.relations.length && !state.entities.length
      && !Object.values(state.properties || {}).filter(desc => desc.property).length) {
    return;
  }
  expate.vlm.shell.mkdir("-p", expate.vlm.path.join(expate.targetDir, ...restate.dirParts));
  restate.reservedTrivialNames = {};
  // reserve case-insentive slots or mark conflict
  for (const vSubMedia of state.medias) _getSubRestate(restate, vSubMedia);
  for (const vSubEntity of state.entities) _getSubRestate(restate, vSubEntity);

  await _exportStateOf(expate, restate, state);
  await _exportRelationsOf(expate, restate, state.relations);
  await _exportMediasOf(expate, restate, state.medias);
  await _exportEntitiesOf(expate, restate, state.entities);
}

async function _exportStateOf (
    expate, restate, { properties /* , medias, relations, entities */ }) {
  const vstate = {};
  for (const [k, v] of [
    ...Object.entries(properties),
    ...Object.getOwnPropertySymbols(properties).map(s => [String(s), properties[s]]),
  ]) {
    if (v.value !== undefined) {
      vstate[k] = Array.isArray(v.value) ? v.value.map(_serialize) : _serialize(v.value);
    } else {
      vstate[k] = v;
    }
  }
  const vstatePath = expate.vlm.path.join(expate.targetDir, ...restate.dirParts, "~$V.state.json");
  await expate.vlm.writeFile(vstatePath, JSON.stringify(vstate, null, 2), "utf8");
}

function _serialize (value) {
  if (typeof value !== "object" || (value === null)) return value;
  if (value.getVRef) return value.getVRef().toString();
  if (Array.isArray(value)) return value.map(_serialize);
  if (Object.getPrototypeOf(value) === Object.prototype) {
    return Object.entries(value).reduce((o, [k, v]) => { o[k] = _serialize(v); return o; }, {});
  }
  throw new Error("Complex value serialization not implemented");
}

async function _exportEntitiesOf (expate, restate, vEntities) {
  for (const vEntity of vEntities) {
    const subRestate = _getSubRestate(restate, vEntity, "+");
    subRestate.dirParts.push(...(
        subRestate.trivialName ? [subRestate.trivialName]
            : subRestate.structuredParts
                || [`${subRestate.verb}@${subRestate.vgrid}`]));
    await _exportResourceDirectory(expate, subRestate);
  }
}

async function _exportRelationsOf (expate, restate, vRelations) {
  for (const vRelation of vRelations) {
    const subRestate = _getSubRestate(restate, vRelation, "-out--");
    subRestate.dirParts.push(...(
        subRestate.structuredParts
            || [subRestate.verb, subRestate.vgrid]));
    await _exportResourceDirectory(expate, subRestate);
  }
}

async function _exportMediasOf (expate, restate, vMedias) {
  for (const vMedia of vMedias) {
    const subRestate = _getSubRestate(restate, vMedia, "~");
    const vContent = vMedia.step("content");
    const subParts = subRestate.structuredParts || [`${subRestate.verb}@${subRestate.vgrid}`];
    if (vContent) {
      const fileName = subRestate.trivialName
          || `${subParts.join("@")}@@#${subRestate.escaped}`;
      const bvobId = vContent.getRawId();
      const fileRelParts = [...restate.dirParts, fileName];
      const fileRelPath = [".", ...fileRelParts].join("/");
      const content = await vMedia.extractValue({ contentType: "application/octet-stream" });
      const buffer = (content instanceof ArrayBuffer) ? Buffer.from(content)
          : (content instanceof Uint8Array) ? content
          : undefined;
      let info = expate.bvobInfos[bvobId];
      if (!info) {
        info = expate.bvobInfos[bvobId] = { byteLength: buffer.length, mediaPaths: [] };
        if (expate.bvobBuffers) {
          expate.bvobBuffers[bvobId] = { base64: base64URLFromBuffer(buffer) };
        }
      }
      info.mediaPaths.push(fileRelPath);
      await expate.vlm.writeFile(expate.vlm.path.join(expate.targetDir, ...fileRelParts), content);
    }
    subRestate.dirParts.push(...subParts);
    await _exportResourceDirectory(expate, subRestate, { skipIfEmpty: true });
  }
}

function _getSubRestate (restate, vSubResource, verbType) {
  const name = vSubResource.step(["§.", "name"]);
  let trivialName = name;
  if (trivialName.match(_reservedCharRegex)) trivialName = undefined;
  if (trivialName) {
    const lowercaseName = trivialName.toLowerCase();
    if (_reservedNames[lowercaseName]) {
      trivialName = undefined;
    } else if (restate.reservedTrivialNames[lowercaseName] === undefined) {
      restate.reservedTrivialNames[lowercaseName] = trivialName; // reserve
    } else if (restate.reservedTrivialNames[lowercaseName] !== trivialName) {
      restate.reservedTrivialNames[lowercaseName] = true; // mark conflict
      trivialName = undefined;
    } // else no conflict
  }
  if (!verbType) return undefined;
  const namespace = "";
  const encoded = encodeURIComponent(name);
  const idSteps = vSubResource.getRawId()
      .replace(/:/g, ";")
      .match(/^@?(.*?)(@@)?$/)[1].split("@");
  const ret = {
    vResource: vSubResource,
    dirParts: [...restate.dirParts],
    trivialName,
    escaped: encoded.replace(/\*/g, "%2A"),
    verb: `${verbType}${namespace};${encoded}`,
    vgrid: idSteps[0],
  };
  if (idSteps.length > 1) {
    ret.hostVGRIDIndex = restate.hostVGRIDIndex || (ret.dirParts.length - 1);
    let i = 0;
    while ((i !== idSteps.length)
        && (idSteps[i] === (!i ? restate.vgrid : ret.dirParts[ret.hostVGRIDIndex + i]))) ++i;
    if (i === 0) {
      throw new Error(`Inconsistent sub-resource host <${
          ret.vgrid}>: not equal to owner host <${restate.vgrid}>`);
    }
    if (i === idSteps.length) {
      throw new Error(`Inconsistent sub-resource id ${
          vSubResource.getRawId()} is a subset of its owner <${restate.vResource.getRawId()}>`);
    }
    ret.structuredParts = idSteps.slice(i);
  }
  return ret;
}

const _reservedCharRegex = /(([$/<>:"\\|?*].*)|\.)$/;

const _reservedNames = { // these names are reserved on windows
  con: true, prn: true, aux: true, nul: true,
  com1: true, com2: true, com3: true, com4: true, com5: true,
  com6: true, com7: true, com8: true, com9: true, com0: true,
  lpt1: true, lpt2: true, lpt3: true, lpt4: true, lpt5: true,
  lpt6: true, lpt7: true, lpt8: true, lpt9: true, lpt0: true,
};
