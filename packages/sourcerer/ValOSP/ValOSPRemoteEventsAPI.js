// @flow

import { FabricEventTarget, fetchJSON } from "@valos/tools";

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
            ? `'(*ge'i!${startIndex})`
            : `'(*in'i!${startIndex || 0}'i!${endIndex})`;
    const narrateRoute = `${connection.getValOSPChronicleURL()}-log${indexFilterPlot}`;
    this.logEvent(2, () => [
      `GET events from chronicle ${connection.getName()} via <${narrateRoute}>`,
    ]);
    const ret = fetchJSON(narrateRoute, {
      method: "GET", mode: "cors",
    });
    return !isSingular ? ret : ret.then(res => [res]);
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
    const options = {
      method, mode: "cors",
      headers: { "Content-Type": "application/json" },
      body: isMulti ? commands : commands[0],
    };
    const ret = fetchJSON(proclaimRoute, options);
    return ret.then(results =>
        (isMulti ? results : [results]).map((event, index) => event || commands[index]));
  }

  subscribeToEventMessages (/* connection */) {
    return undefined;
  }
}
