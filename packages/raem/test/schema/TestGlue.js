// @flow
import { GraphQLObjectType } from "graphql/type";

import aliasField from "~/raem/tools/graphql/aliasField";
import primaryField from "~/raem/tools/graphql/primaryField";

import Discoverable, { discoverableInterface } from "~/raem/schema/Discoverable";
import TransientFields from "~/raem/schema/TransientFields";
import Resource from "~/raem/schema/Resource";
import Position from "~/raem/schema/Position";
import { toOne } from "~/raem/tools/graphql/coupling";

const OBJECT_DESCRIPTION = "test partition glue";

export default new GraphQLObjectType({
  name: "TestGlue",

  interfaces: () => [Discoverable, Resource, TransientFields],

  description: "An entity connection in 3d space",

  fields: () => ({
    ...discoverableInterface(OBJECT_DESCRIPTION).fields(),

    ...aliasField("source", "owner", Discoverable,
        "The source partition of the glue",
        { coupling: toOne({ coupledField: "targetGlues" }), affiliatedType: "TestGlue" },
    ),

    ...primaryField("target", Discoverable,
        "The target partition of the glue",
        { coupling: toOne({ coupledField: "sourceGlues" }), affiliatedType: "TestGlue" },
    ),

    ...primaryField("dangling", Discoverable,
        "Reference without named coupling",
        { affiliatedType: "TestGlue" },
    ),

    ...primaryField("position", Position,
        "Reference without named coupling",
    ),
  }),
});
