import createContentAPI from "~/raem/tools/graphql/createContentAPI";

import EngineContentAPI from "~/engine/EngineContentAPI";
import ProphetTestAPI from "~/prophet/test/ProphetTestAPI";

import TestScriptyThing from "~/script/test/schema/TestScriptyThing";

export default createContentAPI({
  name: "ValOSEngineTestAPI",
  inherits: [EngineContentAPI, ProphetTestAPI],
  exposes: [TestScriptyThing],
});
