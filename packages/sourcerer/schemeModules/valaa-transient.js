// @flow

import { Authority, SOURCERER_EVENT_VERSION } from "~/sourcerer";
import type { SchemeModule } from "~/sourcerer";
import { naiveURI } from "~/raem";

export default function createValaaTransientScheme (/* { parent } */): SchemeModule {
  return {
    scheme: "valaa-transient",

    createChronicleURI: naiveURI.createChronicleURI,
    splitChronicleURI: naiveURI.splitChronicleURI,

    obtainAuthorityConfig: (/* chronicleURI: string, authorityPreConfig: Object */) => ({
      eventVersion: SOURCERER_EVENT_VERSION,
      isLocallyRecorded: false,
      isPrimaryAuthority: true,
      isRemoteAuthority: false,
    }),

    createAuthority: (options: Object) => new Authority(options),
  };
}
