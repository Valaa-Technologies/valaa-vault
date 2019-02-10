// @flow

export const ObjectJSONSchema = Symbol("Object-JSONSchema");
export const ArrayJSONSchema = Symbol("Array-JSONSchema");

export const EmailType = { type: "EmailType" };
export const BooleanType = { type: "boolean" };
export const StringType = { type: "string" };
export const NumberType = { type: "double" };
export const URIReferenceType = { type: "uri-reference" };

export const UnixEpochSecondsType = { type: "double" };
export const DateExtendedISO8601Type = { type: "date" };
export const TimeExtendedISO8601Type = { type: "time" };
export const ZoneExtendedISO8601Type = { type: "string" };
export const DateTimeZoneExtendedISO8601Type = { type: "date-time" };

export const $VType = {
  [ObjectJSONSchema]: {},
  id: IdValOSType,
  name: StringType, // internal ValOS name
};

export const IdValOSType = { type: "string" };
export const ReferenceValOSType = { type: "uri" };

/* eslint-disable */

export function RelationType (TargetType) {
  return {
    [ArrayJSONSchema]: {},
    [ObjectJSONSchema]: {},
    $V: {
      [ObjectJSONSchema]: {},
      ...$VType,
      target: ReferenceValOSType,
      href: URIReferenceType,
      rel: StringType,
    },
  };
}

export function listCollectionGETSchema (Type) {
  return expandSchemaSymbols(Type);
}

export function createEntryPOSTSchema (Type) {
  return expandSchemaSymbols(Type);
}

export function retrieveEntryGETSchema (Type, { idKueryKey }) {
  return expandSchemaSymbols(Type);
}

export function updateEntryPATCHSchema (Type, { idKueryKey }) {
  return expandSchemaSymbols(Type);
}

export function destroyEntryDELETESchema (Type, { idKueryKey }) {
  return expandSchemaSymbols(Type);
}
