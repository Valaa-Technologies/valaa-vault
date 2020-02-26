// @flow

import { denoteValOSKueryFunction } from "~/raem/VALK";

import { ValoscriptNew, ValoscriptInstantiate } from "~/script";

import VALEK from "~/engine/VALEK";
import Vrapper from "~/engine/Vrapper";

import { newResource, instantiateResource } from "~/engine/valosheath/valos/_resourceLifetimeOps";

const symbols = {
  interpretContent: Symbol("Media.interpretContent"),
  readContent: Symbol("Media.readContent"),
  immediateContent: Symbol("Media.immediateContent"),
  getURL: Symbol("Media.getURL"),
  immediateURL: Symbol("Media.immediateURL"),
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
        `returns the Media content if it is immediately available,${
        ""} otherwise throws an error. This error can be a missing${
        ""} connection error which triggers an implicit${
        ""} connection process.${
        ""} See Media.interpretContent for more details.`
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
        `returns a promise to an interpretation of the Media content${
        ""} with a particular media type. This media type is${
        ""} determined by the first valid entry from the list:${
        ""} 1. options.contentType argument of this call${
        ""} 2. Media.mediaType field of this Media resource${
        ""} 3. inferred from the Media name extension${
        ""} 4. options.fallbackContentType of this call`
    )(function interpretContent (options: any) {
      const ret = VALEK.interpretContent({
        synchronous: false,
        mediaInfo: Vrapper.toMediaInfoFields,
        ...(options || {}),
      }).toVAKON();
      return ret;
    }),
    [symbols.immediateURL]: denoteValOSKueryFunction(
        `returns a Media URL to access the Media content if one is${
        ""} is immediately available, otherwise throws an error.${
        ""} This error can be a missing connection error${
        ""} which triggers an implicit connection process.${
        ""} See Media.getURL for more details.`
    )(function immediateURL (options: any) {
      return VALEK.mediaURL({
        synchronous: true,
        mediaInfo: Vrapper.toMediaInfoFields,
        ...(options || {}),
      }).toVAKON();
    }),
    [symbols.getURL]: denoteValOSKueryFunction(
        `returns a promise to a transient Media URL which can be used${
        ""} to retrieve the Media content in a presentation context.
        ""} By default this URL is only guaranteed to be usable for${
        ""} a limited period of time and only in the current${
        ""} presentation context (ie. current HTML render context or${
        ""} similar).`
    )(function getURL (options: any) {
      return VALEK.mediaURL({
        synchronous: false,
        mediaInfo: Vrapper.toMediaInfoFields,
        ...(options || {}),
      }).toVAKON();
    }),
  },
};
