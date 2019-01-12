import CreateBard, {
  prepareCreateOrDuplicateObjectTransientAndId, convertLegacyOwnerField, prepareDenormalizedRoot,
  recurseCreateOrDuplicate, mergeDenormalizedStateToState,
} from "~/raem/redux/reducers/construct";

import { createTransient } from "~/raem/state/Transient";

import { invariantifyString } from "~/tools";

export default function create (bard: CreateBard) {
  const passage = bard.passage;
  invariantifyString(passage.typeName, "CREATED.typeName required");

  let initialState = passage.initialState;
  if (!(passage.meta || {}).isVirtualAction) {
    const bailOut = prepareCreateOrDuplicateObjectTransientAndId(bard, passage.typeName);
    if (bailOut) return bailOut;
    initialState = convertLegacyOwnerField(bard, initialState);
  } else {
    // This passage is a sub-passage of some ghost materialization.
    bard.objectId = passage.id;
    bard.objectTypeName = passage.typeName;
    bard.objectTransient = createTransient(passage);
  }
  const denormalizedRoot = prepareDenormalizedRoot(bard);
  recurseCreateOrDuplicate(bard, passage.typeName, initialState);
  return mergeDenormalizedStateToState(bard, denormalizedRoot);
}
