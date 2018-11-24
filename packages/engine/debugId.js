// @flow

import isSymbol from "~/tools/isSymbol";
import { getTransientTypeName } from "~/raem/state/Transient";
import dumpify from "~/tools/dumpify";

export default function debugId (object: any, options: any) {
  const short = options && options.short;
  if ((object == null) || (typeof object !== "object") || isSymbol(object)) {
    const ret = dumpify(object, {
      sliceAt: (typeof short === "number" ? short : (short ? 30 : 60)), sliceSuffix: "...",
    });
    return (typeof object !== "string") ? ret : `<string "${ret}">`;
  }
  if (Array.isArray(object)) {
    return `<[${object.map(entry => debugId(entry, options)).join(", ")}]>`;
  }
  if (typeof object.debugId === "function") return object.debugId(options);
  if (typeof object.get === "function") {
    const name = object.get("name");
    return `<${getTransientTypeName(object)} ${((name && `"${name}"`) || "")}${
        short ? "" : `'${object.get("id")}'`}>`;
  }
  const keys = !short
      ? `{ ${Object.keys(object).join(", ")} }`
      : `${Object.keys(object).length} keys`;
  return `<${(object.constructor || { name: "object" }).name} ${keys}>`;
}
