// @flow

import { denoteValOSKueryFunction } from "~/raem/VALK";
import { qualifiedSymbol } from "~/tools/namespace";

import { ValoscriptNew, ValoscriptInstantiate } from "~/script";

import VALEK from "~/engine/VALEK";
import Vrapper from "~/engine/Vrapper";

import { newResource, instantiateResource } from "~/engine/valosheath/resourceLifetimeOps";

const symbols = {
  interpretContent: qualifiedSymbol("V", "interpretContent"),
  // readContent: qualifiedSymbol("V", "readContent"),
  immediateContent: qualifiedSymbol("V", "immediateContent"),
  getURL: qualifiedSymbol("V", "getURL"),
  immediateURL: qualifiedSymbol("V", "immediateURL"),
};

export default {
  isGlobal: true,
  symbols,
  typeFields: {
    [ValoscriptNew]: newResource,
    [ValoscriptInstantiate]: instantiateResource,
  },
  prototypeFields: {
    [symbols.immediateContent]: denoteValOSKueryFunction([
`Returns Media content if immediately available or throws otherwise.`,
`Media content is immediately available if its has been downloaded and
marked as in-memory cacheable.

The thrown error can be a missing connection error which triggers an
implicit connection process.

See V:interpretContent for more details.`,
        ],
        { cache: 0 },
    )(function immediateContent (options: any) {
      return VALEK.interpretContent({
        synchronous: true,
        mediaInfo: Vrapper.toMediaInfoFields,
        ...(options || {}),
      }).toVAKON();
    }),
    /*
    [symbols.readContent]: denoteValOSKueryFunction(
`Returns a promise to a Media content interpretation.`,
    )(function readContent (options: any) {
      const ret = VALEK.interpretContent({
        synchronous: false,
        mediaInfo: Vrapper.toMediaInfoFields,
        ...(options || {}),
      }).toVAKON();
      return ret;
    }),
    */
    [symbols.interpretContent]: denoteValOSKueryFunction([
`Returns a promise to a Media content interpretation as optionally
given *options.contentType*.`,
`The default contentType if determined as follows:`,
          { "numbered#": [
[`options.contentType argument of this call`],
[`Media.mediaType field of this Media resource`],
[`inferred from the Media name extension`],
[`options.fallbackContentType of this call`],
          ] },
        ],
        { cachingArguments: 0 },
    )(function interpretContent (options: any) {
      const ret = VALEK.interpretContent({
        synchronous: false,
        mediaInfo: Vrapper.toMediaInfoFields,
        ...(options || {}),
      }).toVAKON();
      return ret;
    }),
    [symbols.immediateURL]: denoteValOSKueryFunction([
`Returns a Media content download URL if immediately available or throws an error otherwise.`,
`The returned URL can be used to fetch an online resource in the local
context.

This URL is only temporarily valid. The expiration time is defined by
the chronicle behaviors and its backend implementation.

The error can be a missing connection error which triggers an
implicit connection process.

See V:getURL for more details.`,
        ],
        { cachingArguments: 0 },
    )(function immediateURL (options: any) {
      return VALEK.mediaURL({
        synchronous: true,
        mediaInfo: Vrapper.toMediaInfoFields,
        ...(options || {}),
      }).toVAKON();
    }),
    [symbols.getURL]: denoteValOSKueryFunction([
`Returns a promise to a Media content download URL.`,
`The resolved URL can be used to fetch the Media content in the local
context.

This URL is only temporarily valid. The expiration time is defined by
the chronicle behaviors and its backend implementation.`,
        ],
        { cachingArguments: 0 },
    )(function getURL (options: any) {
      return VALEK.mediaURL({
        synchronous: false,
        mediaInfo: Vrapper.toMediaInfoFields,
        ...(options || {}),
      }).toVAKON();
    }),
  },
};
