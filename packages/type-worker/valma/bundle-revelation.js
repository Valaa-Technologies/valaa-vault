#!/usr/bin/env vlm

exports.command = "bundle-revelation [revelation-path]";
exports.brief = "bundle revela.json preloadable content";
exports.describe = "Bundles chronicles and other preloadable content into a revela.json";
exports.introduction = `
Lists the chronicles listed in the revelation-path prologue.
Preloads their event logs and media contents using vlm export-chronicle.
Bundles these back into revelation files and adds them into prologue
chronicleVLogs, chronicleMediaInfos, bvobInfos and bvobBuffers sections.`;

exports.disabled = (yargs) => !yargs.vlm.packageConfig;
exports.builder = (yargs) => yargs.options({
  "chronicles-dir": {
    type: "string", default: "./revelation/chronicles",
    description: `Target directory for chronicle exports`
  },
  "revelogundle-path": {
    type: "string", default: "./revelogundle.json",
    description: `Target revelation prologue bundle file.`,
  },
});

exports.handler = async (yargv) => {
  const vlm = yargv.vlm;
  const perspire = require("./perspire");
  vlm.initializeClock();
  let revelationPath = yargv["revelation-path"] || "./";
  revelationPath = vlm.path.join(".", revelationPath,
      ...(revelationPath[revelationPath.length - 1] === "/" ? ["revela.json"] : []));
  const revelaJSON = JSON.parse(await vlm.readFile(revelationPath));
  let worker = perspire.getWorker();
  let workerJob;
  if (!worker) {
    vlm.clock("bundle-revelation", "bundle.worker.create");
    workerJob = vlm.invoke("perspire", [{
      interval: 2,
      repeats: true,
      "stop-event": "bundle.done",
      "job-view": { lens: "disabled", isView: true },
      interactive: true,
    }, ...(yargv._ || [])]);
    await Promise.resolve();
    worker = perspire.getWorker();
  }
  const gateway = await (await worker).getGateway();
  vlm.shell.mkdir(yargv["chronicles-dir"]);
  const bundle = {
    chronicleInfos: {},
    chronicleVLogs: {},
    bvobInfos: ["!!!"],
    bvobBuffers: ["!!!"],
  };
  let exports = gateway.prologueConnections.map(async connection => {
    const chronicleURI = connection.getChronicleURI();
    const chronicleId = connection.getChronicleId();
    const targetDir = vlm.path.join(
        yargv["chronicles-dir"], chronicleId.slice(1, -2).replace(/:/g, ";"));
    const ret = {
      chronicleURI, chronicleId, targetDir,
      ...(await vlm.invoke(
          "export-chronicle", [{ "bvob-buffers": true }, chronicleURI, targetDir])),
    };
    if (ret.chronicleInfosEntry) bundle.chronicleInfos[chronicleId] = ret.chronicleInfosEntry;
    if (ret.chronicleVLogsEntry) bundle.chronicleVLogs[chronicleId] = ret.chronicleVLogsEntry;
    if (ret.bvobInfosEntry) bundle.bvobInfos.push(ret.bvobInfosEntry);
    if (ret.bvobBuffersEntry) bundle.bvobBuffers.push(ret.bvobBuffersEntry);
    return ret;
  });
  exports = await Promise.all(exports);
  const prologueSequence = (revelaJSON.prologue == null) ? ["!!!"]
      : (revelaJSON.prologue[0] === "!!!") ? revelaJSON.prologue
      : ["!!!", revelaJSON.prologue];
  if (!prologueSequence.find(spreader =>
      (spreader != null) && (spreader["!!!"] === yargv["revelogundle-path"]))) {
    revelaJSON.prologue = prologueSequence;
    prologueSequence.push({ "!!!": yargv["revelogundle-path"] });
    await vlm.writeFile(revelationPath, JSON.stringify(revelaJSON, null, 2));
  }
  const revelogundleString =
`{
  "chronicleInfos": ${JSON.stringify({ "": bundle.chronicleInfos || {} }, null, 2).slice(8, -2)},
  "chronicleVLogs": {
${Object.entries(bundle.chronicleVLogs || {}).map(([key, value]) =>
`    ${JSON.stringify(key)}: ${JSON.stringify(value)}`).join(",\n")}
  },
  "bvobInfos": ["!!!",
${(bundle.bvobInfos || []).slice(1).map(bvobInfo =>
`    ${JSON.stringify(bvobInfo)}`).join(",\n")}
  ],
  "bvobBuffers": ["!!!",
${(bundle.bvobBuffers || []).slice(1).map(bvobBuffer =>
`    ${JSON.stringify(bvobBuffer)}`).join(",\n")}
  ]
}
`;
  await vlm.writeFile(yargv["revelogundle-path"], revelogundleString);

  vlm.clock("bundle-revelation", "bundle.done");
  if (workerJob) {
    const ret = await workerJob;
    console.log("post-bundle perspire:", ret);
  }
  return { success: true, exports };
};
