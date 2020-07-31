// @flow
import { GraphQLObjectType, GraphQLList, GraphQLNonNull } from "graphql/type";

import aliasField from "~/raem/tools/graphql/aliasField";
import primaryField from "~/raem/tools/graphql/primaryField";
import transientField from "~/raem/tools/graphql/transientField";

import { toOne, toMany, toManyOwnlings, toNone } from "~/raem/tools/graphql/coupling";

import Blob from "~/raem/schema/Blob";
import Data from "~/raem/schema/Data";
import Discoverable, { discoverableInterface } from "~/raem/schema/Discoverable";
import TransientFields from "~/raem/schema/TransientFields";
import Chronicle, { chronicleInterface } from "~/raem/schema/Chronicle";
import Resource from "~/raem/schema/Resource";

import SemVer from "~/raem/schema/SemVer";
import Sprite from "~/raem/schema/Sprite";
import MediaType from "~/raem/schema/MediaType";

import TestDataGlue from "~/raem/test/schema/TestDataGlue";
import TestGlue from "~/raem/test/schema/TestGlue";

const OBJECT_DESCRIPTION = "testing chronicle";

const TestThing = new GraphQLObjectType({
  name: "TestThing",

  description: "An encompassing chronicle for testing RAEM schema and tools.",

  interfaces: () => [Chronicle, Discoverable, Resource, TransientFields],

  fields: () => ({
    ...discoverableInterface(OBJECT_DESCRIPTION).fields(),
    ...chronicleInterface(OBJECT_DESCRIPTION).fields(),

    ...aliasField("parent", "owner", TestThing,
        "Non-owning parent test chronicle",
        { coupling: toOne({ coupledField: "children" }), affiliatedType: "TestThing" },
    ),

    ...primaryField("children", new GraphQLList(TestThing),
        "Ownling child test chronicles",
        { coupling: toManyOwnlings({}), affiliatedType: "TestThing" },
    ),

    ...primaryField("siblings", new GraphQLList(TestThing),
        "Sibling test chronicles",
        { coupling: toMany({ coupledField: "siblings" }), affiliatedType: "TestThing" },
    ),

    ...primaryField("uncoupledField", TestThing,
        "TestThing reference with no coupling",
        { coupling: toNone() },
    ),

    ...primaryField("targetGlues", new GraphQLList(TestGlue),
        "Target Glue's",
        { coupling: toManyOwnlings({}), affiliatedType: "TestThing" },
    ),

    ...transientField("sourceGlues", new GraphQLList(TestGlue),
        "Source Glue's",
        { coupling: toMany({ coupledField: "target" }), affiliatedType: "TestThing" },
    ),

    ...primaryField("sourceDataGlues", new GraphQLList(TestDataGlue),
        "Source DataGlue's",
    ),

    ...primaryField("targetDataGlues", new GraphQLList(Data),
        "Target DataGlue's",
    ),

    ...primaryField("version", new GraphQLNonNull(SemVer),
        "Version of the testing chronicle",
    ),

    ...primaryField("bvobs", new GraphQLList(Blob),
        "Bvob's contained in the testing chronicle",
    ),

    ...primaryField("music", new GraphQLList(Sprite),
        "Referenced abstract denoted music Sprite's in the testing chronicle",
    ),
  }),
});

export default TestThing;
