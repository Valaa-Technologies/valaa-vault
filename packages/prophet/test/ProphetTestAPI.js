import createContentAPI from "~/raem/tools/graphql/createContentAPI";

import ProphetContentAPI from "~/prophet/ProphetContentAPI";
import ScriptTestAPI from "~/script/test/ScriptTestAPI";

export default createContentAPI({
  name: "ValOSProphetTestAPI",
  inherits: [ProphetContentAPI, ScriptTestAPI],
  exposes: [],
});
