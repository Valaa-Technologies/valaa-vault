import { getTransientTypeName } from "~/raem/tools/denormalized/Transient";

export default function debugId (object: any, options: any) {
  const short = options && options.short;
  if (object === null) return "<null>";
  if (object === undefined) return "<undefined>";
  if (typeof object === "function") return `<function ${object.name}>`;
  if (typeof object === "string") {
    const maxLen = (short === undefined) ? 60 : (typeof short === "number") ? short : 30;
    return `<string "${object.length < maxLen ? object : `${object.slice(0, maxLen - 3)}...`}">`;
  }
  if (typeof object !== "object") return `<${typeof object} ${String(object)}>`;
  if (Array.isArray(object)) {
    return `[${object.map(entry => debugId(entry, options)).join(", ")}]`;
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
