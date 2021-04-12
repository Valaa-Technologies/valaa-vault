// @flow

import { swapAspectRoot } from "~/sourcerer/tools/EventAspects";

import { FabricEventTarget, fetchJSON } from "~/tools";

export default class ValOSPRemoteEventsAPI extends FabricEventTarget {
  _authorityConfig: Object;

  constructor (authority, authorityConfig) {
    super(authority, undefined, authorityConfig.name);
    this._authorityConfig = authorityConfig;
  }

  isConnected () {
    // Push event subscription not specified and thus not implemented
    return false;
  }

  narrateRemoteEventLog (connection, startIndex, endIndex, identities) {
    const isSingular = startIndex + 1 === endIndex;
    const indexFilterPlot =
        isSingular
            ? `!${startIndex}/`
        : (startIndex || 0) === 0 && (endIndex == null)
            ? ""
        : (endIndex == null)
            ? `'!${startIndex}`
            : `'!${startIndex || 0}'!${endIndex}`;
    const narrateRoute = `${connection.getValOSPChronicleURL()}-log${indexFilterPlot}`;
    this.logEvent(2, () => [
      `GET events from chronicle ${connection.getName()} via <${narrateRoute}>`,
    ]);
    const ret = fetchJSON(narrateRoute, {
      method: "GET", mode: "cors",
    });
    return ret.then(res => (!isSingular ? res : [res])
        .map(event => swapAspectRoot("event", event, "delta")));
  }

  proclaimRemoteCommands (connection, startIndex, commands, identities) {
    const isMulti = commands.length > 1;
    const method = isMulti ? "POST" : "PUT";
    const proclaimRoute = `${
        connection.getValOSPChronicleURL()}-log${isMulti ? "" : `!${startIndex}/`}`;
    this.logEvent(2, () => [
      `${method} command${isMulti ? "s" : ""} to chronicle ${connection.getName()
          } via <${proclaimRoute}>`,
    ]);
    this.logEvent(2, () => [
      `\t${method} command(s) #${startIndex} success`,
    ]);
    const outCommands = commands.map(command => {
      if (!command.aspects.delta) command.aspects.delta = {};
      return swapAspectRoot("delta", command, "event");
    });
    let ret;
    try {
      const options = {
        method, mode: "cors",
        headers: { "Content-Type": "application/json" },
        body: isMulti ? outCommands : outCommands[0],
      };
      ret = fetchJSON(proclaimRoute, options);
    } finally {
      for (const command of outCommands) {
        swapAspectRoot("event", command, "delta");
      }
    }
    return ret.then(results => {
      let index = 0;
      for (const result of isMulti ? results : [results]) {
        Object.assign(commands[index++].aspects, result || {});
      }
      return commands;
    });
  }

  subscribeToEventMessages (/* connection */) {
    return undefined;
  }
}
