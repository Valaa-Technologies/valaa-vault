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

// TODO(iridian): This introduces library cross-dependence and should be replaced.
import Scope, { scopeInterface } from "~/script/schema/Scope";
import TransientScriptFields, { transientScriptFields }
    from "~/script/schema/TransientScriptFields";

const OBJECT_DESCRIPTION = "testing chronicle";

const TestScriptyThing = new GraphQLObjectType({
  name: "TestScriptyThing",

  description: "An encompassing chronicle for testing RAEM schema and tools.",

  interfaces: () => [
    Chronicle, Scope, TransientScriptFields,
    Discoverable, Resource, TransientFields,
  ],

  fields: () => ({
    ...discoverableInterface(OBJECT_DESCRIPTION).fields(),
    ...scopeInterface(OBJECT_DESCRIPTION).fields(),
    ...transientScriptFields(OBJECT_DESCRIPTION).fields(),
    ...chronicleInterface(OBJECT_DESCRIPTION).fields(),

    ...aliasField("parent", "owner", TestScriptyThing,
        "Non-owning parent test chronicle",
        { coupling: toOne({ coupledField: "children" }) },
    ),

    ...primaryField("children", new GraphQLList(TestScriptyThing),
        "Ownling child test chronicles",
        { coupling: toManyOwnlings() },
    ),

    ...primaryField("siblings", new GraphQLList(TestScriptyThing),
        "Sibling test chronicles",
        { coupling: toMany({ coupledField: "siblings" }) },
    ),

    ...primaryField("uncoupledField", TestScriptyThing,
        "TestScriptyThing reference with no coupling",
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

export default TestScriptyThing;
