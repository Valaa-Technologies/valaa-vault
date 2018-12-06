// @flow
import { GraphQLObjectType } from "graphql/type";

import aliasField from "~/raem/tools/graphql/aliasField";
import primaryField from "~/raem/tools/graphql/primaryField";
import { toOne } from "~/raem/tools/graphql/coupling";

import Describable from "~/raem/schema/Describable";
import Discoverable from "~/raem/schema/Discoverable";
import TransientFields from "~/raem/schema/TransientFields";
import Position from "~/raem/schema/Position";
import Resource from "~/raem/schema/Resource";
import Scope from "~/script/schema/Scope";

import Relatable, { relatableInterface } from "~/script/schema/Relatable";
import TransientScriptFields from "~/script/schema/TransientScriptFields";

const OBJECT_DESCRIPTION = "relation";

export default new GraphQLObjectType({
  name: "Relation",

  interfaces: () => [
    Relatable, Scope, TransientScriptFields,
    Describable, Discoverable, Resource, TransientFields,
  ],

  description: "An abstract relation between typically two objects which can have properties.",

  fields: () => ({
    ...relatableInterface(OBJECT_DESCRIPTION).fields(),

    ...aliasField("source", "owner", Relatable,
        "The source entity of this relation",
        { coupling: toOne({ coupledField: "relations" }) },
    ),

    ...primaryField("target", Relatable,
        "The target entity of this relation",
        { coupling: toOne({ coupledField: "incomingRelations" }) },
    ),

    ...primaryField("position", Position,
        "The position of the target entity in the source context",
    ),

    ...primaryField("rotation", Position,
        "The rotation of the target entity in the source context, in degrees",
    ),
  }),
});
