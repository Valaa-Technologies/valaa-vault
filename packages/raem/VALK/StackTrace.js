// @flow

import { invariantifyObject, invariantifyString } from "~/tools/invariantify";
import { dumpObject } from "~/raem/VALK/Kuery";

type VALKSourceInfo = {
  phase: string,
  partitionName: string,
  mediaName: string,
  source: string,
  sourceMap: Object,
}

type VALKStackFrame = {
  sourceObject: any,
  sourceInfo: VALKSourceInfo,
};

type VALKStackTrace = Array<VALKStackFrame>;

export const SourceInfoTag = Symbol("VALK.SourceInfo");

export function addStackFrameToError (error: Error, sourceObject: Object,
    sourceInfo: Object): Error {
  if (!sourceInfo || (error == null) || (typeof error !== "object")) return error;
  invariantifyString(sourceInfo.mediaName, "(!sourceInfo || sourceInfo.mediaName)");
  invariantifyString(sourceInfo.source, "(!sourceInfo || sourceInfo.source)");
  invariantifyObject(sourceInfo.sourceMap, "(!sourceInfo || sourceInfo.sourceMap)",
      { allowEmpty: true });
  const stackFrame = { sourceObject, sourceInfo };
  // TODO(iridian): fix hack: grep wrapError.js outputError for "sourceStackFrames"
  error.sourceStackFrames = (error.sourceStackFrames || []).concat(stackFrame);
  error.customErrorHandler = function (logger) {
    logger.error(`Valaa stack trace originating from ${sourceInfo.phase || "unknown context"}:`);
    const messages = parseErrorMessagesFromStackTrace(this.sourceStackFrames);
    messages.forEach(components => components && logger.error("    ", ...components));
  };
  return error;
}

export function parseErrorMessagesFromStackTrace (stackTrace: VALKStackTrace) {
  const ret = [];
  const latestError = {
    mediaInfoString: "",
    start: {},
    end: {},
    repeats: 0,
    messages: [],
  };
  function commitLatestError () {
    if (!latestError.messages.length) return;
    ret.push([
      latestError.lineInfo,
      latestError.repeats > 1 ? `(repeated ${latestError.repeats} times):` : ":",
      ...latestError.messages,
    ]);
  }
  stackTrace.forEach(frame => {
    const mediaName = frame.sourceInfo.mediaName;
    const partitionInfo = frame.sourceInfo.partitionName
        ? `partition "${frame.sourceInfo.partitionName}"` : "unspecified partition";
    const mediaInfoString = `in media "${mediaName}" of ${partitionInfo}`;
    const mapEntry = frame.sourceInfo.sourceMap.get(frame.sourceObject);

    // Gets the error boundaries
    const start = !mapEntry ? { line: -1, column: -1 } : mapEntry.loc.start;
    const end = !mapEntry ? { line: -1, column: -1 } : mapEntry.loc.end;

    // Bail out early if this a repeat of the previous error message
    if (latestError.start.line === start.line
        && latestError.end.line === end.line
        && latestError.mediaInfoString === mediaInfoString) {
      latestError.repeats++;
      return;
    }

    commitLatestError();

    if (!mapEntry) {
      latestError.messages = [
        `indeterminate lines (no source mapping found) ${mediaInfoString} for source component`,
        ...dumpObject(frame.sourceObject.toJSON ? frame.sourceObject.toJSON() : frame.sourceObject),
      ];
      return;
    }

    latestError.start = start;
    latestError.end = end;
    latestError.mediaInfoString = mediaInfoString;
    latestError.repeats = 0;
    latestError.lineInfo = `line ${start.line}, column ${start.column} ${mediaInfoString}`;
    // Create a descriptive string describing the location of the problem
    if (!frame.sourceInfo.source) {
      latestError.messages = [`<no source available>`];
    } else {
      // Get the relevant source snippet
      const sourceLines = frame.sourceInfo.source.split("\n");
      const snippetLines = sourceLines.slice(start.line - 1, end.line);
      if (snippetLines.length === 1) {
        // Creates an underline line for single-line errors
        let underlineLength = end.column - start.column;
        if (!(underlineLength > 0)) underlineLength = 1;
        const underline = `${" ".repeat(start.column)}${"^".repeat(underlineLength)}`;
        latestError.lineInfo = `line ${start.line}, columns ${start.column} to ${end.column} ${
            mediaInfoString}`;
        latestError.messages = [`\n${snippetLines[0]}\n${underline}\n`];
      } else if (snippetLines.length > 1) {
        latestError.lineInfo = `lines ${start.line} (col ${start.column}) to ${end.line} (col ${
            end.column}) ${mediaInfoString}`;
        latestError.messages = [`\n> ${snippetLines.join("\n> ")}\n`];
      } else {
        latestError.messages = [`<no line contents found>`];
      }
    }
  });
  commitLatestError();
  return ret;
}
