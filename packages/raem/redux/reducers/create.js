import CreateBard, {
  prepareCreateOrDuplicateObjectTransientAndId, convertLegacyOwnerField, prepareDenormalizedRoot,
  recurseCreateOrDuplicate, mergeDenormalizedStateToState,
} from "~/raem/redux/reducers/construct";

import { createTransient } from "~/raem/tools/denormalized/Transient";
import { invariantifyString } from "~/tools";

export default function create (bard: CreateBard) {
  invariantifyString(bard.passage.typeName, "CREATED.typeName required");

  let initialState = bard.passage.initialState;
  if (!(bard.passage.local || {}).noSubMaterialize) {
    const bailOut = prepareCreateOrDuplicateObjectTransientAndId(bard, bard.passage.typeName);
    if (bailOut) return bailOut;
    initialState = convertLegacyOwnerField(bard, initialState);
  } else {
    // This passage is a sub-passage of some ghost materialization.
    bard.objectId = bard.passage.id;
    bard.setTypeName(bard.passage.typeName);
    bard.objectTransient = null;
  }
  const denormalizedRoot = prepareDenormalizedRoot(bard);
  // TODO(iridian): Deal with Data types using createDataTransient
  bard.objectTransient = bard.objectTransient
      ? bard.objectTransient.set("typeName", bard.passage.typeName)
      : createTransient({ id: bard.objectId, typeName: bard.passage.typeName });
  recurseCreateOrDuplicate(bard, initialState);
  return mergeDenormalizedStateToState(bard, denormalizedRoot);
}

