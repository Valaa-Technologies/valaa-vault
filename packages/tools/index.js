// @flow

import exportValaaPlugin from "./exportValaaPlugin";

import * as mediaDecoders from "./mediaDecoders";

export default exportValaaPlugin({ name: "@valos/tools", mediaDecoders });


export { default as valaaHash } from "./id/valaaHash";
export { default as valaaUUID } from "./id/valaaUUID";

export { exportValaaPlugin };

export const contentIdFromArrayBuffer = require("./id/contentId").contentIdFromArrayBuffer;
export const contentIdFromNativeStream = require("./id/contentId").contentIdFromNativeStream;

export const createId = require("./id/createId").default;

export const derivedId = require("./id/derivedId").default;

export { arrayFromAny, iterableFromAny } from "./sequenceFromAny";

export const beaumpify = require("./beaumpify").default;

export const deepExtend = require("./deepExtend").default;

export const dumpify = require("./dumpify").default;

export { default as getGlobal } from "./getGlobal";

export const immutate = require("./immutate").default;

export const invariantify = require("./invariantify").default;
export const invariantifyArray = require("./invariantify").invariantifyArray;
export const invariantifyBoolean = require("./invariantify").invariantifyBoolean;
export const invariantifyFunction = require("./invariantify").invariantifyFunction;
export const invariantifyNumber = require("./invariantify").invariantifyNumber;
export const invariantifyObject = require("./invariantify").invariantifyObject;
export const invariantifyString = require("./invariantify").invariantifyString;

export const inBrowser = require("./inBrowser").default;

export const isPromise = require("./isPromise").default;
export const isSymbol = require("./isSymbol").default;

export { default as inProduction } from "./inProduction";

export const Logger = require("./Logger").default;
export const LogEventGenerator = require("./Logger").LogEventGenerator;
export const createForwardLogger = require("./Logger").createForwardLogger;

export const SimpleData = require("./SimpleData").default;

export const thenChainEagerly = require("./thenChainEagerly").default;

export { toVDoc } from "./vdoc";

export const wrapError = require("./wrapError").default;
export const messageFromError = require("./wrapError").messageFromError;
export const dumpObject = require("./wrapError").dumpObject;
export const outputError = require("./wrapError").outputError;
export const outputCollapsedError = require("./wrapError").outputCollapsedError;
export const unwrapError = require("./wrapError").unwrapError;

export const request = require("./request").default;

export const traverse = require("./traverse").default;
