// @flow

// Event Aspects

// Event aspects provides shared types and idioms for conveniently but
// robustly managing event messages as they travel throughout ValOS
// event streams. Each stage of the processing has only the most
// relevant aspect of the message promoted as the root object for easy,
// extensible and and non-cluttered access. All other aspects and their
// properties are still available through the EventAspects object.
//
// EventAspects itself is a context-free structure which contains all
// information throughough event message lifetime through the ValOS
// streams. These properties are grouped to different contextual and/or
// functional aspects.
//
// EventAspects also introduces an idiom of promoting one of these
// aspects to be the root object for the message in a specific context:
// 1. reducers inside Corpus promote Event aspect as the root, so that
//    root.type, root.actions etc. are directly available.
// 2. IndexedDB storage promotes Log aspect as the root so that
//    root.logIndex can be used the key and root.timeStamp is directly
//    visible available for manual debugging.
// 3. An authority plugin network serializer might promote Buffer
//    aspect as the root to facilitate performant serialization.
// 4. etc.
//
// In contexts where root is still a javascript/JSON object the other
// aspects are accessible like so: `root.aspect.log.logIndex`.
//
// As a general principle when a message is sent forward in the streams
// the ownership of the message object is also transferred also. This
// means that the recipient is free to mutate the message in-place
// (even destructively).
// Specifically this means that promoting a different aspect when
// transferring a message forward is simply:
// ```
// const newRoot = root.aspects[newRootAspect];
// newRoot.aspects = root.aspects;
// delete root.aspects; // The 'aspects' must be only available from the current root.
// ```

import { EventBase } from "~raem/events";
import type HashV240 from "~prophet/tools/hashV240";

export default class EventAspects {
  version: string;

  event: ?EventBase;
  command: ?CommandAspect;
  log: ?LogAspect;
  envelope: ?EnvelopeAspect;
  buffer: ?BufferAspect;
}

export function addToAspect (root: Object, targetAspectName: string, newAspectProperties) {
  const aspects = root.aspects || (root.aspects = new EventAspects());
  const existingAspect = aspects[targetAspectName];
  if (existingAspect) Object.assign(existingAspect, newAspectProperties);
  else aspects[targetAspectName] = newAspectProperties;
}

export function promoteAspect (root: Object, newRootAspectName: string) {
  const aspects = root.aspects;
  delete root.aspects;
  aspects[newRootAspectName].aspects = aspects;
  return aspects[newRootAspectName];
}

class BufferAspect {
  // JSON.stringify(aspect.event)
  event: ?ArrayBuffer;

  // JSON.stringify(aspect.command)
  command: ?ArrayBuffer;

  // JSON.stringify(aspect.chain)
  log: ?ArrayBuffer;

  // JSON.stringify(aspect.envelope)
  envelope: ?ArrayBuffer;

  // Contains the other aspects. Only present if this aspect is the root aspect.
  aspects: ?EventAspects;
}

class CommandAspect {
  // Command identifier
  // uuidv4 || hashV240(`${aspect.command.idCertId} ${aspect.command.idSalt}`)
  // HashV240 is required for all signed and/or multi-partition events.
  // uuid or HashV240 is required for all events which create resources.
  id: number | string | HashV240;

  // Certificate id of a certificate that has been registered to this
  // event log and hasn't been revoked which used as the derivation
  // base of the command.id and optionally for signing the command.
  idCertId: ?string;

  // A monotonously increasing number (per idCertId in the the targeted
  // event log)
  // Required for signed events
  idSalt: ?number;

  // hashV240(aspect.buffer.event)
  // Required for signed and multi-partition events
  eventHash: ?HashV240;

  // map of all other partitions and their particular event hashes
  // of a multi-partition command with the same commandId.
  // Required for multi-partition events.
  partitions: ?{ [partitionURI: string]: HashV240 };

  // Contains the other aspects. Only present if this aspect is the root aspect.
  aspects: ?EventAspects;
}

class LogAspect {
  // Index of the command in the event log.
  logIndex: number;

  // Unix epoch milliseconds as an integer.
  timeStamp: number;

  // hashV240(aspect.buffer.command)
  commandHash: HashV240;

  // sign(getPrivateCertificate(aspect.command.idCertId), aspect.chain.commandHash)
  commandSignature: ?string;

  // hashV240(`{aspect.command.eventHash} ${aspect.chain.timeStamp} ${
  //     aspect.chain.commandSignature} ${previousEventInChain.aspect.chain.chainHash}`)
  chainHash: HashV240;

  // Contains the other aspects. Only present if this aspect is the root aspect.
  aspects: ?EventAspects;
}

class EnvelopeAspect {
  newResourceIds: ?string[];
  prevCommandId: ?string;
  reorder: ?Object;
  commandSignature: ?string; // sign(privateCert, aspect.buffer.command)

  // Contains the other aspects. Only present if this aspect is the root aspect.
  aspects: ?EventAspects;
}
