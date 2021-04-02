// @flow

import { naiveURI } from "~/raem";

import { Authority, SOURCERER_EVENT_VERSION } from "~/sourcerer";
import type { SchemeModule } from "~/sourcerer";
import { createChronicleRootVRID0Dot2 } from "~/sourcerer/tools/event-version-0.2/createVRID0Dot2";

export default function createValaaMemoryScheme (/* { parent } */): SchemeModule {
  return {
    scheme: "valaa-memory",

    createChronicleRootId: createChronicleRootVRID0Dot2,
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
