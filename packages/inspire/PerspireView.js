// @flow

import readline from "readline";

import "@babel/polyfill";
import VDOMView from "~/inspire/VDOMView";

/**
 * This class is the view entry point
 */
export default class PerspireView extends VDOMView {
  async attach (container, viewConfig) {
    const ret = await super.attach(container, viewConfig);
    await this._waitForConnectionsToActivate();
    this.warnEvent(1, () => [
      `attach(): engine running, view attached to DOM and all initial UI chronicle${
        ""} connections complete`,
    ]);
    return ret;
  }

  runInteractive () {
    const vFocus = this.getFocus();
    if (!vFocus) throw new Error("view focus missing for interactive");
    const mutableScope = Object.create(vFocus.getValospaceScope());
    const plog1 = this.opLog(1, "interact",
        "Opening job interactive", { focus: vFocus });
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let externalExit = false;
    rl.on("line", async (command) => {
      if (!command) return;
      plog1 && plog1.opEvent("command",
          "Executing command", { action: `executing interactive command`, command });
      const sourceInfo = {
        phase: "interactive command transpilation",
        source: command,
        mediaName: "worker.interactive.command",
        sourceMap: new Map(),
      };
      try {
        const result = await vFocus.doValoscript(command, {}, { sourceInfo, mutableScope });
        plog1 && plog1.opEvent("result",
            "Command resulted", { action: "interactive command result", command, result });
      } catch (error) {
        plog1 && plog1.opEvent("error",
            "Command errored", {
          action: "interactive command error", command, message: error.message, error,
        });
      }
    }).on("close", () => {
      plog1 && plog1.opEvent("close",
          "Job interactive closed", externalExit || "end of stream");
      if (!externalExit) process.exit(0);
    });
    return {
      close (jobResult, jobError) {
        externalExit = jobError ? "job failed" : "job complete";
        rl.close();
      }
    };
  }

  async _waitForConnectionsToActivate () {
    let pendingConnections;
    while (true) { // eslint-disable-line no-constant-condition
      pendingConnections = this._vFocus.getEngine().getSourcerer().getActivatingConnections();
      const keys = Object.keys(pendingConnections);
      if (!keys.length) break;
      this.warnEvent(1, () => [
        `attach(): acquiring pending UI-initiated connections:`, ...keys,
      ]);
      await Promise.all(Object.values(pendingConnections));
    }
    this.warnEvent(1, () => [
      `attach(): all connections acquired:`,
      ...Object.values(this._vFocus.getEngine().getSourcerer().getActiveConnections())
          .map(connection => `\n\t${connection.debugId()}`),
    ]);
  }
}
