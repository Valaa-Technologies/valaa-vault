// @flow

import { chronicleURIResolver } from "./partitionResolver";

export default function vrefResolver (source: any, args: any, options: Object) {
  const chronicleURI = chronicleURIResolver(source, args, options);
  return `${chronicleURI || ""}#${source.get("id").rawId()}`;
}
