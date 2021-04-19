import { EventBase } from "~/raem/events";

type Hash40 = string;

export const EVENT_VERSION = "0.3";

export function getEventIndex (anyAspect) {
  const aspects = anyAspect.aspects || anyAspect;
  const logAspect = aspects.log || aspects;
  return logAspect.index;
}

export function encodeVPlotValue (value) {
  return encodeURIComponent(value)
      .replace(/[%!'()*]/g, c => (c === "%" ? "!" : `'${c.charCodeAt(0).toString(16)}`));
}

export function decodeVPlotValue (value) {
  return value.replace(/!/g, "%").decodeURIComponent(value);
}

export class EventAspects {
  version: string;

  delta: ?DeltaAspect;
  command: ?CommandAspect;
  log: ?LogAspect;
  proclaim: ?ProclaimAspect;
  buffer: ?BufferAspect;
}

class EventAspect {
  // @context @base VLog
  // Contains the other aspects. Only present if this aspect is the root aspect.
  aspects: ?EventAspects;
}

class DeltaAspect extends EventAspect {}

class BufferAspect extends EventAspect {
  // JSON.stringify(aspect.event)
  event: ?ArrayBuffer;

  // JSON.stringify(aspect.command)
  command: ?ArrayBuffer;

  // JSON.stringify(aspect.chain)
  log: ?ArrayBuffer;

  // JSON.stringify(aspect.envelope)
  envelope: ?ArrayBuffer;
}

class CommandAspect extends EventAspect {
  // Command identifier
  // uuidv4 || Hash40(`${aspect.command.idCertId} ${aspect.command.idSalt}`)
  // Hash40 is required for all signed and/or multi-chronicle events.
  // uuid or Hash40 is required for all events which create resources.
  id: number | string | Hash40;

  // Certificate id of a certificate that has been registered to this
  // event log and hasn't been revoked which used as the derivation
  // base of the command.id and optionally for signing the command.
  idCertId: ?string;

  // A monotonously increasing number (per idCertId in the the targeted
  // event log)
  // Required for signed events
  idSalt: ?number;

  // Hash40(aspect.buffer.event)
  // Required for signed and multi-chronicle events
  eventHash: ?Hash40;

  // map of all other chronicles and their particular event hashes
  // of a multi-chronicle command with the same aspects.command.id.
  // Required for multi-chronicle events.
  chronicles: ?{ [chronicleURI: string]: Hash40 };
}

class LogAspect extends EventAspect {
  // Index of the command in the event log.
  index: number;

  // Unix epoch milliseconds as an integer.
  timeStamp: number;

  // Hash40(aspect.buffer.command)
  commandHash: Hash40;

  // sign(getPrivateCertificate(aspect.command.idCertId), aspect.chain.commandHash)
  commandSignature: ?string;

  // Hash40(`{aspect.command.eventHash} ${aspect.chain.timeStamp} ${
  //     aspect.chain.commandSignature} ${previousEventInChain.aspect.chain.vplotHashV0}`)
  vplotHashV0: Hash40;
}

class ProclaimAspect extends EventAspect {
  newResourceIds: ?string[];
  prevCommandId: ?string;
  reorder: ?Object;
  commandSignature: ?string; // sign(privateCert, aspect.buffer.command)
}
