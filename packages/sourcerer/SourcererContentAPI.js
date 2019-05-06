import createContentAPI from "~/raem/tools/graphql/createContentAPI";

import ScriptContentAPI from "~/script/ScriptContentAPI";
import Entity from "~/sourcerer/schema/Entity";
import Media from "~/sourcerer/schema/Media";
import validators from "~/sourcerer/tools/sourcererEventValidators";

export default createContentAPI({
  name: "ValOSSourcererContentAPI",
  inherits: [ScriptContentAPI],
  exposes: [Media, Entity],
  validators,
});
