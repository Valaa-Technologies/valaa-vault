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
    const mutableScope = Object.create(vFocus.getLexicalScope());

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let externalExit = false;
    rl.on("line", async (command) => {
      if (!command) return;
      this.clockEvent(1, `worker.interactive.command`, {
        action: `executing interactive command`, command,
      });
      const sourceInfo = {
        phase: "interactive command transpilation",
        source: command,
        mediaName: "worker.interactive.command",
        sourceMap: new Map(),
      };
      try {
        const result = await vFocus.doValoscript(command, {}, { sourceInfo, mutableScope });
        this.clockEvent(1, `worker.interactive.result`, {
          action: "executed interactive command", command, result,
        });
      } catch (error) {
        this.clockEvent(1, `worker.interactive.error`, {
          action: "caught exception during interactive command", command,
          message: error.message, error,
        });
      }
    }).on("close", () => {
      this.infoEvent(1, "Closing perspire job interactive:", externalExit || "end of stream");
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
