import { getTransientTypeName } from "~/raem/tools/denormalized/Transient";

export default function debugId (object: any, options: any) {
  if (!object) return "null";
  if (typeof object === "string") return object;
  if (typeof object !== "object") return String(object);
  if (Array.isArray(object)) {
    return `[${object.map(entry => debugId(entry)).join(", ")}]`;
  }
  if (typeof object.debugId === "function") return object.debugId(options);
  if (typeof object.get === "function") {
    const name = object.get("name");
    return `${((name && `"${name}"/`) || "")}${
        (options && options.short) ? "" : `'${object.get("id")}'`}:${
        getTransientTypeName(object)}`;
  }
  return "unrecognized object";
}
