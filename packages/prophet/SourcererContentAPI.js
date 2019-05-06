import createContentAPI from "~/raem/tools/graphql/createContentAPI";

import ScriptContentAPI from "~/script/ScriptContentAPI";
import Entity from "~/prophet/schema/Entity";
import Media from "~/prophet/schema/Media";
import validators from "~/prophet/tools/sourcererEventValidators";

export default createContentAPI({
  name: "ValOSSourcererContentAPI",
  inherits: [ScriptContentAPI],
  exposes: [Media, Entity],
  validators,
});
