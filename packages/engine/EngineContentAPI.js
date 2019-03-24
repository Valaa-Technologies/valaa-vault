import createContentAPI from "~/raem/tools/graphql/createContentAPI";

import ProphetContentAPI from "~/prophet/ProphetContentAPI";

export default createContentAPI({
  name: "ValOSEngineContentAPI",
  inherits: [ProphetContentAPI],
  exposes: [],
});
