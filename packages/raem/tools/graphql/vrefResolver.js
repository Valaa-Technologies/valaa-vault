// @flow

import { partitionURIResolver } from "./partitionResolver";

export default function vrefResolver (source: any, args: any, options: Object) {
  const chronicleURI = partitionURIResolver(source, args, options);
  return `${chronicleURI || ""}#${source.get("id").rawId()}`;
}
