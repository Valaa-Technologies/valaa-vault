// @flow

import type { AuthorityConfig, AuthorityOptions, Sourcerer } from "~/sourcerer";

import { EVENT_VERSION as FUTURE_EVENT_VERSION, encodeVPlotValue }
    from "~/sourcerer/tools/event-version-0.3";
import { createChronicleRootVRID0Dot3 }
    from "~/sourcerer/tools/event-version-0.3/createVRID0Dot3";

import ValOSPAuthority from "~/sourcerer/ValOSP/ValOSPAuthority";

import { thenChainEagerly, fetchJSON } from "~/tools";
import type { ValaaURI } from "~/raem/ValaaURI";

export default function createValOSProtocolScheme ({ parent } = {}) {
  return {
    scheme: "valosp",

    createChronicleRootId: createChronicleRootVRID0Dot3,

    createChronicleURI (authorityURI: string, chronicleId: string) {
      if (authorityURI.slice(-1) !== "/") {
        throw new Error(`valosp authorityURI must end in '/', got <${authorityURI}>`);
      }
      let chroniclePlot = chronicleId;
      if (chronicleId.startsWith("@$")) {
        chroniclePlot = chronicleId.slice(2, -2).replace(".", "!");
      }
      return `${authorityURI}${chroniclePlot}/`;
    },

    splitChronicleURI (chronicleURI: string): [string, string] {
      return chronicleURI.match(/^(valosp:\/\/.*\/)([^/]+)\/$/).slice(1);
    },

    obtainAuthorityConfig (authorityURI: ValaaURI, maybePreConfig: ?AuthorityConfig):
        AuthorityConfig {
      const httpsEndpointBase = `https${authorityURI.slice(6)}`;
      return thenChainEagerly(
          maybePreConfig || fetchJSON(
              `${httpsEndpointBase}~aur!${encodeVPlotValue(authorityURI)}/.authorityConfig/`,
              { method: "GET", mode: "cors" }),
          preConfig => {
            if (!preConfig) return null;
            const ret = {
              // valosp will start from 0.3 by default
              eventVersion: FUTURE_EVENT_VERSION,
              isLocallyRecorded: true,
              isPrimaryAuthority: true,
              isRemoteAuthority: true,
              ...preConfig,
            };
            if (ret.isRemoteAuthority && !ret.endpoint) {
              ret.endpoint = httpsEndpointBase;
            }
            return ret;
          },
          error => {
            console.log(
                "Error while fetching authorityConfig for", authorityURI, ":", { error });
            return null;
          });
    },

    createAuthority (options: AuthorityOptions): Sourcerer {
      const name = options.authorityConfig.name;
      if (options.nexus) {
        options.nexus.logEvent(
            `Connecting to authority "${name}" at <${options.authorityURI}>`);
      }
      return new ValOSPAuthority({ name, parent, ...options });
    }
  };
}
