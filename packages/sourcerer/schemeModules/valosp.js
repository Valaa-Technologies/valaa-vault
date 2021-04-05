// @flow

import type { AuthorityConfig, AuthorityOptions, Sourcerer } from "~/sourcerer";

import { EVENT_VERSION as FUTURE_EVENT_VERSION, encodeVPlotValue }
    from "~/sourcerer/tools/event-version-0.3";
import { createChronicleRootVRID0Dot3 }
    from "~/sourcerer/tools/event-version-0.3/createVRID0Dot3";

import ValOSPAuthority from "~/sourcerer/ValOSP/ValOSPAuthority";

import { thenChainEagerly, fetchJSON, outputError, wrapError } from "~/tools";
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
      const url = `${httpsEndpointBase}~aur!${encodeVPlotValue(authorityURI)}/.authorityConfig/`;
      return thenChainEagerly(
          maybePreConfig || fetchJSON(url, { method: "GET", mode: "cors" }),
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
            outputError(wrapError(error, 1,
                error.chainContextName("valosp.obtainAuthorityConfig"),
                "\n\tGET url:", url,
            ));
            throw new Error(`Unable to connect to authority <${authorityURI
                }>: could not fetch authority config. See console for more details.`);
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
