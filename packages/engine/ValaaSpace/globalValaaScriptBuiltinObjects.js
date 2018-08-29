import { vRef } from "~/raem/ValaaReference";
import VALEK from "~/engine/VALEK";
import { request } from "~/tools";

// TODO(iridian): I think this is dead code. Verify and remove or at least deprecate, using
// accessor properties which output warnings but return the concrete values below.

export default {
  vRef,
  setField: VALEK.setField(VALEK.fromScope("$1"), VALEK.fromScope("$2")),
  addToField: VALEK.addToField(VALEK.fromScope("$1"), VALEK.fromScope("$2")),
  removeFromField: VALEK.removeFromField(VALEK.fromScope("$1"), VALEK.fromScope("$2")),
  create: VALEK.create(VALEK.fromScope("$1"), VALEK.fromScope("$2")),
  destroy: VALEK.destroy(VALEK.fromScope("$1")),
  emplaceSetField: VALEK.emplaceSetField(VALEK.fromScope("$1"), VALEK.fromScope("$2")),
  emplaceAddToField: VALEK.emplaceAddToField(VALEK.fromScope("$1"), VALEK.fromScope("$2")),
  do: VALEK.do(VALEK.fromScope("$1"), VALEK.fromScope("$2")),

  blobContent: VALEK.blobContent(VALEK.fromScope("$1"), VALEK.fromScope("$2")),
  mediaURL: VALEK.mediaURL(),
  mediaContent: VALEK.mediaContent(),
  interpretContent: VALEK.interpretContent(VALEK.fromScope("$1")),
  prepareBlob: VALEK.prepareBlob(VALEK.fromScope("$1"), VALEK.fromScope("$1")),

  asyncRequest: request,
};
