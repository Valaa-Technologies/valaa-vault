import createContentAPI from "~/raem/tools/graphql/createContentAPI";

import ScriptContentAPI from "~/script/ScriptContentAPI";
import RAEMTestAPI from "~/raem/test/RAEMTestAPI";
import TestScriptyThing from "~/script/test/schema/TestScriptyThing";

export default createContentAPI({
  name: "ValoscriptTestAPI",
  inherits: [ScriptContentAPI, RAEMTestAPI],
  exposes: [TestScriptyThing],
  absentType: ScriptContentAPI.absentType,
  destroyedType: ScriptContentAPI.destroyedType,
});
