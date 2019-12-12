import { vRef } from "~/raem/VRL";
// import VALEK from "~/engine/VALEK";
import { fetchJSON } from "~/tools";

// TODO(iridian): I think this is dead code. Verify and remove or at least deprecate, using
// accessor properties which output warnings but return the concrete values below.

export default {
  vRef,
  asyncFetch: fetchJSON,
};
