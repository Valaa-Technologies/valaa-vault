// @flow

import * as mediaDecoders from "./mediaDecoders";

export const valosheath = require("~/gateway-api/valosheath").default;
export const inBrowser = require("~/gateway-api/inBrowser").default;
export const getGlobal = require("~/gateway-api/getGlobal").default;

export default valosheath.exportSpindle({ name: "@valos/tools", mediaDecoders });

export { default as valosHash } from "./id/valosHash";
export { default as valosUUID } from "./id/valosUUID";

export const contentHashFromArrayBuffer = require("./id/contentId").contentHashFromArrayBuffer;
export const contentHashFromNativeStream = require("./id/contentId").contentHashFromNativeStream;

export { default as DelayedQueue } from "./DelayedQueue";

export { arrayFromAny, iterableFromAny } from "./sequenceFromAny";

export const beaumpify = require("./beaumpify").default;

export const patchWith = require("./patchWith").default;

export const dumpify = require("./dumpify").default;

export const immutate = require("./immutate").default;

export const invariantify = require("./invariantify").default;
export const invariantifyArray = require("./invariantify").invariantifyArray;
export const invariantifyBoolean = require("./invariantify").invariantifyBoolean;
export const invariantifyFunction = require("./invariantify").invariantifyFunction;
export const invariantifyNumber = require("./invariantify").invariantifyNumber;
export const invariantifyObject = require("./invariantify").invariantifyObject;
export const invariantifyString = require("./invariantify").invariantifyString;

export const isPromise = require("./isPromise").default;
export const isSymbol = require("./isSymbol").default;

export { default as inProduction } from "./inProduction";

export const FabricEvent = require("./FabricEvent").default;
export const FabricEventTarget = require("./FabricEvent").FabricEventTarget;

export const SimpleData = require("./SimpleData").default;

export const thenChainEagerly = require("./thenChainEagerly").thenChainEagerly;
export const thisChainEagerly = require("./thenChainEagerly").thisChainEagerly;
export const thisChainReturn = require("./thenChainEagerly").thisChainReturn;
export const mapEagerly = require("./thenChainEagerly").mapEagerly;
export const wrapOutputError = require("./thenChainEagerly").wrapOutputError;

export const trivialClone = require("./trivialClone").default;

export { vdon, vdocorate } from "./vdon";

export const messageFromError = require("./wrapError").messageFromError;
export const debugObject = require("./wrapError").debugObject;
export const debugObjectType = require("./wrapError").debugObjectType;
export const dumpObject = require("./wrapError").dumpObject;
export const outputError = require("./wrapError").outputError;
export const outputCollapsedError = require("./wrapError").outputCollapsedError;
export const unwrapError = require("./wrapError").unwrapError;
export const wrapError = require("./wrapError").wrapError;

export const fetchJSON = require("./fetchJSON").default;

export const traverse = require("./traverse").default;
