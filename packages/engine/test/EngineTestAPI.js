import createContentAPI from "~/raem/tools/graphql/createContentAPI";

import EngineContentAPI from "~/engine/EngineContentAPI";
import SourcererTestAPI from "~/sourcerer/test/SourcererTestAPI";

import TestScriptyThing from "~/script/test/schema/TestScriptyThing";

export default createContentAPI({
  name: "ValOSEngineTestAPI",
  inherits: [EngineContentAPI, SourcererTestAPI],
  exposes: [TestScriptyThing],
});
