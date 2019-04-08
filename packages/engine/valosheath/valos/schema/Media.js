// @flow

import { denoteValOSKueryFunction } from "~/raem/VALK";

import { ValoscriptNew, ValoscriptInstantiate } from "~/script";

import VALEK from "~/engine/VALEK";
import Vrapper from "~/engine/Vrapper";

import { newResource, instantiateResource } from "~/engine/valosheath/valos/_resourceLifetimeOps";

const symbols = {
  immediateContent: Symbol("Media.immediateContent"),
  readContent: Symbol("Media.readContent"),
  interpretContent: Symbol("Media.interpretContent"),
  getURL: Symbol("Media.getURL"),
};

export default {
  isGlobal: true,
  symbols,
  typeFields: {
    [ValoscriptNew]: newResource,
    [ValoscriptInstantiate]: instantiateResource,
  },
  prototypeFields: {
    [symbols.immediateContent]: denoteValOSKueryFunction(
        `returns the Media content if it is immediately available.`
    )(function immediateContent (options: any) {
      return VALEK.interpretContent({
        synchronous: true,
        mediaInfo: Vrapper.toMediaInfoFields,
        ...(options || {}),
      }).toVAKON();
    }),
    [symbols.readContent]: denoteValOSKueryFunction(
        `returns a promise to the Media content.`
    )(function readContent (options: any) {
      const ret = VALEK.interpretContent({
        synchronous: false,
        mediaInfo: Vrapper.toMediaInfoFields,
        ...(options || {}),
      }).toVAKON();
      return ret;
    }),
    [symbols.interpretContent]: denoteValOSKueryFunction(
        `returns a promise to the Media content.`
    )(function interpretContent (options: any) {
      const ret = VALEK.interpretContent({
        synchronous: false,
        mediaInfo: Vrapper.toMediaInfoFields,
        ...(options || {}),
      }).toVAKON();
      return ret;
    }),
    [symbols.getURL]: denoteValOSKueryFunction(
        `returns a promise to a transient Media URL which can be used in the local${
        ""} context (ie. browser HTML) to access the Media content.`
    )(function getURL (options: any) {
      return VALEK.mediaURL({
        synchronous: false,
        mediaInfo: Vrapper.toMediaInfoFields,
        ...(options || {}),
      }).toVAKON();
    }),
  },
};
