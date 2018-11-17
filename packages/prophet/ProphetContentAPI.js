import createContentAPI from "~/raem/tools/graphql/createContentAPI";

import ScriptContentAPI from "~/script/ScriptContentAPI";
import Entity from "~/prophet/schema/Entity";
import Media from "~/prophet/schema/Media";
import validators from "~/prophet/tools/prophetEventValidators";

export default createContentAPI({
  name: "ValaaProphetContentAPI",
  inherits: [ScriptContentAPI],
  exposes: [Media, Entity],
  validators,
});
