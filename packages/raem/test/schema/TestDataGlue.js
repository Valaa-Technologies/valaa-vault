import { GraphQLObjectType } from "graphql/type";

import primaryField from "~/raem/tools/graphql/primaryField";

import Data, { dataInterface } from "~/raem/schema/Data";
import Discoverable from "~/raem/schema/Discoverable";

const OBJECT_DESCRIPTION = "test chronicle glue";

export default new GraphQLObjectType({
  name: "TestDataGlue",

  interfaces: () => [Data],

  description: "An entity connection in 3d space",

  fields: () => ({
    ...dataInterface(OBJECT_DESCRIPTION).fields(),

    ...primaryField("source", Discoverable,
        "The source chronicle of the glue",
    ),

    ...primaryField("target", Discoverable,
        "The target chronicle of the glue",
    ),
  }),
});
