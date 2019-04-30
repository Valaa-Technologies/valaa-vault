import { base64FromUnicode, base64FromBuffer } from "~/gateway-api/base64";

export function encodeDataURI (bufferOrUnicode: any, type: string = "text", subtype: string = "plain") {
  let str;
  if (typeof bufferOrUnicode === "string") str = base64FromUnicode(bufferOrUnicode);
  else if (bufferOrUnicode instanceof ArrayBuffer) str = base64FromBuffer(bufferOrUnicode);
  else throw new Error(`Cannot convert content of type ${typeof content} into data URI`);
  return `data:${type}/${subtype};charset=UTF-8;base64,${str}`;
}
