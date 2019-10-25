import { vRef } from "~/raem/VRL";
// import VALEK from "~/engine/VALEK";
import { request } from "~/tools";

// TODO(iridian): I think this is dead code. Verify and remove or at least deprecate, using
// accessor properties which output warnings but return the concrete values below.

export default {
  vRef,
  asyncFetch: request,
  /*
  setField: VALEK.setField(VALEK.fromScope("$1"), VALEK.fromScope("$2")),
  addToField: VALEK.addToField(VALEK.fromScope("$1"), VALEK.fromScope("$2")),
  removeFromField: VALEK.removeFromField(VALEK.fromScope("$1"), VALEK.fromScope("$2")),
  create: VALEK.create(VALEK.fromScope("$1"), VALEK.fromScope("$2")),
  destroy: VALEK.destroy(VALEK.fromScope("$1")),
  emplaceSetField: VALEK.emplaceSetField(VALEK.fromScope("$1"), VALEK.fromScope("$2")),
  emplaceAddToField: VALEK.emplaceAddToField(VALEK.fromScope("$1"), VALEK.fromScope("$2")),
  do: VALEK.do(VALEK.fromScope("$1"), VALEK.fromScope("$2")),

  bvobContent: VALEK.bvobContent(VALEK.fromScope("$1"), VALEK.fromScope("$2")),
  blobContent: VALEK.bvobContent(VALEK.fromScope("$1"), VALEK.fromScope("$2")),
  mediaURL: VALEK.mediaURL(),
  mediaContent: VALEK.mediaContent(),
  interpretContent: VALEK.interpretContent(VALEK.fromScope("$1")),
  prepareBvob: VALEK.prepareBvob(VALEK.fromScope("$1"), VALEK.fromScope("$1")),
  prepareBlob: VALEK.prepareBvob(VALEK.fromScope("$1"), VALEK.fromScope("$1")),
  */
};
