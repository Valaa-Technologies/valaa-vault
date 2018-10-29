import createContentAPI from "~/raem/tools/graphql/createContentAPI";

import { RAEMContentAPI } from "~/raem";
import TestThing from "~/raem/test/schema/TestThing";

export default createContentAPI({
  name: "ValOSRAEMTestAPI",
  inherits: [RAEMContentAPI],
  exposes: [TestThing],
});
