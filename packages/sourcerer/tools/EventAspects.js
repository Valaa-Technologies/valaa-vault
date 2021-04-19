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
// information throughout event message lifetime through the ValOS
// streams. These properties are grouped to different contextual and/or
// functional aspects.
//
// EventAspects also introduces an idiom of promoting one of these
// aspects to be the root object for the message in a specific context:
// 1. reducers inside Corpus promote DeltaAspect as the root, so that
//    root.type, root.actions etc. are directly available.
// 2. IndexedDB storage promotes Log aspect as the root so that
//    root.index can be used the key and root.timeStamp is directly
//    visible available for manual debugging.
// 3. An authority network serializer spindle might promote Buffer
//    aspect as the root to facilitate performant serialization.
// 4. etc.
//
// Irrespective of which aspect is currently the root all the other
// aspects are generally accessible like so: `root.aspect.log.index`.
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

export function initializeAspects (root, newAspects = {}) {
  if (root.aspects) Object.assign(root.aspects, newAspects);
  else root.aspects = newAspects;
  return root;
}

export function obtainAspect (root: Object, aspectName: string) {
  if (!root.aspects) throw new Error("root.aspects missing");
  const existingAspect = root.aspects[aspectName];
  if (existingAspect) return existingAspect;
  return (root.aspects[aspectName] = {});
}

const emptyAspect = Object.freeze({});

export function getAspect (root, aspectName) {
  const ret = (root && root.aspects && root.aspects[aspectName]);
  if (ret) return ret;
  throw new Error(`No aspect '${aspectName}' found from event root`);
}

export function tryAspect (root, aspectName) {
  return (root && root.aspects && root.aspects[aspectName]) || emptyAspect;
}

export function obtainAspectRoot (newRootAspectName: string, currentRoot: Object,
    currentRootAspectName: string) {
  obtainAspect(currentRoot, newRootAspectName);
  return swapAspectRoot(newRootAspectName, currentRoot, currentRootAspectName);
}

export function trySwapAspectRoot (aspectName, root, currentRootAspectName: string) {
  return root.aspects[aspectName] && swapAspectRoot(aspectName, root, currentRootAspectName);
}

export function swapAspectRoot (newRootAspectName: string, currentRoot: Object,
    currentRootAspectName: string) {
  const aspects = currentRoot.aspects;
  const newRoot = aspects[newRootAspectName];
  if (!newRoot) throw new Error(`Can't find aspect '${newRootAspectName}' to swap as new root`);
  delete currentRoot.aspects;
  aspects[currentRootAspectName] = currentRoot;
  delete aspects[newRootAspectName];
  newRoot.aspects = aspects;
  return newRoot;
}

