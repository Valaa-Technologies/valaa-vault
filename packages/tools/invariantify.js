// @flow

import wrapError from "~/tools/wrapError";

// Workaround for "_construct" typo in @babel/runtime 7.0.0-beta.49
// https://github.com/babel/babel/issues/8061
const ErrorClass = Error;
export class InvariantError extends ErrorClass {}

export default function invariantify (condition: mixed,
    violationErrorMessage: string, ...contextInformation: any) {
  if (condition) return true;
  throw wrapError(new InvariantError(`Invariant violation: ${violationErrorMessage}`),
      ...(contextInformation || []));
}

export function invariantifyString (candidate: ?string, name: string,
    { value, valueInvariant, allowNull, allowUndefined, allowEmpty = true,
        suffix = "" }: Object = {},
    ...additionalContextInformation: any) {
  if (((typeof candidate === "string")
          && (allowEmpty || candidate.length)
          && (typeof value === "undefined" ||
              (Array.isArray(value) ? value.indexOf(candidate) !== -1 : candidate === value))
          && (!valueInvariant || valueInvariant(candidate)))
      || ((typeof candidate === "undefined") && allowUndefined)
      || (candidate === null && allowNull)) return true;

  return invariantify(false,
      `${name} must be a valid${allowEmpty ? "" : " non-empty"} string${
          typeof value !== "undefined" ? (Array.isArray(value)
              ? ` with value one of ['${value.join("', '")}']`
              : ` with exact value '${value}'`) : ""}${
          valueInvariant ? " obeying given value invariant" : ""}${
          allowNull ? ", or null" : ""}${allowUndefined ? ", or undefined" : ""}${
          suffix}`,
      `\n\t'${name}' candidate:`, candidate,
      ...(valueInvariant ? [`\n\tvalue invariant:`, valueInvariant] : []),
      ...additionalContextInformation);
}

export function invariantifyJson (candidate: ?any, name: string,
    ...additionalContextInformation: any) {
  try {
    JSON.parse(candidate);
    return true;
  } catch (error) {
    return invariantify(false,
      `${name} must be valid JSON`,
      `\n\t'${name}' candidate:`, candidate,
      ...additionalContextInformation);
  }
}

export function invariantifyNumber (candidate: ?number, name: string,
    { value, integer, min, max, valueInvariant, allowNull, allowUndefined, suffix = "" }:
        Object = {},
    ...additionalContextInformation: any) {
  if (((typeof candidate === "number")
          && (!integer || Number.isInteger(candidate))
          && (typeof value === "undefined" || (candidate === value))
          && (typeof min === "undefined" || (min <= candidate))
          && (typeof max === "undefined" || (max >= candidate))
          && (!valueInvariant || valueInvariant(candidate)))
      || ((typeof candidate === "undefined") && allowUndefined)
      || (candidate === null && allowNull)) return true;

  return invariantify(false,
      `'${name}' must be a valid ${integer ? "integral " : ""}number${
          typeof value !== "undefined" ? ` with exact value '${value}'` : ""}${
          typeof min !== "undefined" ? ` value >= ${min}` : ""}${
          typeof max !== "undefined" ? ` value <= ${max}` : ""}${
          valueInvariant ? " obeying given value invariant" : ""}${
          allowNull ? ", or null" : ""}${allowUndefined ? ", or undefined" : ""}${
          suffix}`,
      `\n\t'${name}' candidate:`, candidate,
      ...(valueInvariant ? [`\n\tvalue invariant:`, valueInvariant] : []),
      ...additionalContextInformation);
}

export function invariantifyBoolean (candidate: ?boolean, name: string,
    { value, allowNull, allowUndefined, suffix = "" }: Object = {},
    ...additionalContextInformation: any) {
  if (((typeof candidate === "boolean")
          && (typeof value === "undefined" || (candidate === value)))
      || ((typeof candidate === "undefined") && allowUndefined)
      || (candidate === null && allowNull)) return true;

  return invariantify(false,
      `'${name}' must be a valid boolean${
          typeof value !== "undefined" ? ` with exact value '${value}'` : ""}${
          allowNull ? ", or null" : ""}${allowUndefined ? ", or undefined" : ""}${
          suffix}`,
      `\n\t'${name}' candidate:`, candidate,
      ...additionalContextInformation);
}

export function invariantifyFunction (candidate: ?Function, name: string,
    { allowNull, allowUndefined, suffix = "", parent }: Object = {},
    ...additionalContextInformation: any) {
  if ((typeof candidate === "function")
      || ((typeof candidate === "undefined") && allowUndefined)
      || (candidate === null && allowNull)) return true;

  return invariantify(false,
      `'${name}' must be a valid function${
          allowNull ? ", or null" : ""}${allowUndefined ? ", or undefined" : ""}${
          suffix}`,
      `\n\t'${name}' candidate:`, candidate,
      ...additionalContextInformation);
}

export function invariantifyObject (candidate: ?Object, name: string,
    { valueInvariant, elementInvariant, allowEmpty, allowNull, allowUndefined,
      instanceof: Type, suffix = "" }: Object = {},
    ...additionalContextInformation: any) {
  if (((candidate && typeof candidate === "object")
          && (allowEmpty || Object.keys(candidate).length)
          && (!Type || (candidate instanceof Type))
          && (!valueInvariant || valueInvariant(candidate))
          && (!elementInvariant ||
              !(Object.keys(candidate).find((key, index, object) =>
                  !elementInvariant(candidate[key], key, object)))))
      || ((typeof candidate === "undefined") && allowUndefined)
      || (candidate === null && allowNull)) return true;

  const failingElementKey = elementInvariant && Object.keys(candidate)
      .find((key, index, object) => !elementInvariant(candidate[key], key, object));
  return invariantify(false,
      `'${name}' must be a valid${allowEmpty ? "" : " non-empty"}${
          !Type ? " object" : ` ${Type.name}`}${
              typeof candidate === "object" && (!Type || (candidate instanceof Type))
                  ? ""
                  : ` (got ${(candidate && (typeof candidate === "object") && candidate.constructor
                          && candidate.constructor.name)
                      || typeof candidate})`}${
          valueInvariant ? " obeying given value invariant" : ""}${
          elementInvariant ? ", its elements obeying given element invariant" : ""}${
          allowNull ? ", or null" : ""}${allowUndefined ? ", or undefined" : ""}${
          suffix}`,
      `\n\t'${name}' candidate:`, candidate,
      ...(!allowUndefined && (typeof candidate === "undefined")
          ? ["\n\tInvariant failure: 'undefined' not allowed (specify 'allowUndefined' to allow)"]
          : !allowNull && (candidate === null)
          ? ["\n\tInvariant failure: 'null' not allowed (specify 'allowNull' to allow)"]
          : !Array.isArray(candidate) ? [`\n\texpected an object, got '${typeof candidate}'`]
          : []),
      ...(!allowEmpty && candidate && (typeof candidate === "object")
              && !Object.keys(candidate).length
          ? [`\n\tInvariant failure: expected non-empty object (Object.keys.length !== 0)`] : []),
      ...(Type && (candidate && typeof candidate === "object") && !(candidate instanceof Type)
          ? [`\n\tInvariant failure: expected instanceof '${Type.name}', got ${
              candidate.constructor.name}`] : []),
      ...(valueInvariant && !valueInvariant(candidate)
          ? [`\n\tInvariant failure: value invariant:`, valueInvariant] : []),
      ...(failingElementKey
          ? [`\n\tInvariant failure: key '${failingElementKey}' invariant failed:`,
            elementInvariant,
            "\n\tkey value:", candidate[failingElementKey]] : []),
      ...additionalContextInformation);
}

export function invariantifyArray (candidate: ?any[], name: string,
    { length, min = length, max = length, valueInvariant, elementInvariant, allowNull,
        allowUndefined, suffix = "" }: Object = {},
    ...additionalContextInformation: any) {
  if (((candidate && Array.isArray(candidate))
          && (typeof length === "undefined" || (length === candidate.length))
          && (typeof min === "undefined" || (min <= candidate.length))
          && (typeof max === "undefined" || (max >= candidate.length))
          && (!valueInvariant || valueInvariant(candidate))
          && (!elementInvariant || !(candidate.findIndex((...r) => !elementInvariant(...r)) >= 0)))
      || ((typeof candidate === "undefined") && allowUndefined)
      || (candidate === null && allowNull)) return true;
  const failingElementIndex = (!elementInvariant || !candidate) ? -1
      : candidate.findIndex((...r) => !elementInvariant(...r));
  return invariantify(false,
      `'${name}' must be a valid array${
          typeof min !== "undefined" ? ` with min length ${min}` : ""}${
          typeof max !== "undefined" ? ` with max length ${max}` : ""}${
          valueInvariant ? " obeying given value invariant" : ""}${
          elementInvariant ? ", its elements obeying given element invariant" : ""}${
          allowNull ? ", or null" : ""}${allowUndefined ? ", or undefined" : ""}${
          suffix}`,
      `\n\t'${name}' candidate:`, candidate,
      ...(!allowUndefined && (typeof candidate === "undefined")
          ? ["\n\tInvariant failure: 'undefined' not allowed (specify 'allowUndefined' to allow)"]
          : !allowNull && (candidate === null)
          ? ["\n\tInvariant failure: 'null' not allowed (specify 'allowNull' to allow)"]
          : !Array.isArray(candidate) ? [`\n\texpected an Array, got '${typeof candidate}'`]
          : []),
      ...(Array.isArray(candidate) && typeof length !== "undefined" && length !== candidate.length
          ? [`\n\tInvariant failure: expected length ${length}, got ${candidate.length}`] : []),
      ...(Array.isArray(candidate) && typeof min !== "undefined" && min > candidate.length
          ? [`\n\tInvariant failure: expected min length ${min}, got ${candidate.length}`] : []),
      ...(Array.isArray(candidate) && typeof max !== "undefined" && max < candidate.length
          ? [`\n\tInvariant failure: expected max length ${max}, got ${candidate.length}`] : []),
      ...(valueInvariant && !valueInvariant(candidate)
          ? [`\n\tInvariant failure: value invariant:`, valueInvariant] : []),
      ...(failingElementIndex !== -1
          ? [`\n\tInvariant failure: element #${failingElementIndex} invariant failed:`,
            elementInvariant,
            "\n\telement:", candidate[failingElementIndex]] : []),
      ...additionalContextInformation);
}
