// @flow
import { GraphQLObjectType, GraphQLList, GraphQLNonNull } from "graphql/type";

import aliasField from "~/raem/tools/graphql/aliasField";
import primaryField from "~/raem/tools/graphql/primaryField";
import transientField from "~/raem/tools/graphql/transientField";

import { toOne, toMany, toManyOwnlings, toNone } from "~/raem/tools/graphql/coupling";

import Blob from "~/raem/schema/Blob";
import Data from "~/raem/schema/Data";
import Discoverable, { discoverableInterface } from "~/raem/schema/Discoverable";
import ResourceStub from "~/raem/schema/ResourceStub";
import Partition, { partitionInterface } from "~/raem/schema/Partition";
import Resource from "~/raem/schema/Resource";

import SemVer from "~/raem/schema/SemVer";
import Sprite from "~/raem/schema/Sprite";
import MediaType from "~/raem/schema/MediaType";

import TestDataGlue from "~/raem/test/schema/TestDataGlue";
import TestGlue from "~/raem/test/schema/TestGlue";

const OBJECT_DESCRIPTION = "testing partition";

const TestThing = new GraphQLObjectType({
  name: "TestThing",

  description: "An encompassing partition for testing RAEM schema and tools.",

  interfaces: () => [Partition, Discoverable, Resource, ResourceStub],

  fields: () => ({
    ...discoverableInterface(OBJECT_DESCRIPTION).fields(),
    ...partitionInterface(OBJECT_DESCRIPTION).fields(),

    ...aliasField("parent", "owner", TestThing,
        "Non-owning parent test partition",
        { coupling: toOne({ coupledField: "children" }) },
    ),

    ...primaryField("children", new GraphQLList(TestThing),
        "Ownling child test partitions",
        { coupling: toManyOwnlings() },
    ),

    ...primaryField("siblings", new GraphQLList(TestThing),
        "Sibling test partitions",
        { coupling: toMany({ coupledField: "siblings" }) },
    ),

    ...primaryField("uncoupledField", TestThing,
        "TestThing reference with no coupling",
        { coupling: toNone() },
    ),

    ...primaryField("targetGlues", new GraphQLList(TestGlue),
        "Target Glue's",
        { coupling: toManyOwnlings() },
    ),

    ...transientField("sourceGlues", new GraphQLList(TestGlue),
        "Source Glue's",
        { coupling: toMany({ coupledField: "target" }) },
    ),

    ...primaryField("sourceDataGlues", new GraphQLList(TestDataGlue),
        "Source DataGlue's",
    ),

    ...primaryField("targetDataGlues", new GraphQLList(Data),
        "Target DataGlue's",
    ),

    ...primaryField("version", new GraphQLNonNull(SemVer),
        "Version of the testing partition",
    ),

    ...primaryField("bvobs", new GraphQLList(Blob),
        "Bvob's contained in the testing partition",
    ),

    ...primaryField("music", new GraphQLList(Sprite),
        "Referenced abstract denoted music Sprite's in the testing partition",
    ),

    ...primaryField("mediaType", MediaType,
    `The media type of this test partition`),
  }),
});

export default TestThing;
