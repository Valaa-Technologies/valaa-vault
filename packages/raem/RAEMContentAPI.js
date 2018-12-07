import createContentAPI from "~/raem/tools/graphql/createContentAPI";

import Resource from "~/raem/schema/Resource";
import InactiveResource from "~/raem/schema/InactiveResource";

import mutations from "~/raem/schema/mutation";
import { validators } from "~/raem/events";
import createRAEMReducers from "~/raem/redux/createRAEMReducers";

export default createContentAPI({
  name: "ValOSRAEMContentAPI",
  exposes: [Resource, InactiveResource], // TODO(iridian): Add the rest.
  inactiveType: InactiveResource,
  mutations,
  validators,
  reducers: [createRAEMReducers],
});
