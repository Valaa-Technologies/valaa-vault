import createContentAPI from "~/raem/tools/graphql/createContentAPI";

import SourcererContentAPI from "~/sourcerer/SourcererContentAPI";
import ScriptTestAPI from "~/script/test/ScriptTestAPI";

export default createContentAPI({
  name: "ValOSSourcererTestAPI",
  inherits: [SourcererContentAPI, ScriptTestAPI],
  exposes: [],
});
