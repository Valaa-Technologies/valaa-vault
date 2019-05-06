import createContentAPI from "~/raem/tools/graphql/createContentAPI";

import SourcererContentAPI from "~/prophet/SourcererContentAPI";

export default createContentAPI({
  name: "ValOSEngineContentAPI",
  inherits: [SourcererContentAPI],
  exposes: [],
});
