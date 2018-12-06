// @flow
import { GraphQLInterfaceType, GraphQLString } from "graphql/type";
import primaryField from "~/raem/tools/graphql/primaryField";
import { typeNameResolver } from "~/raem/tools/graphql/typeResolver";

import TransientFields from "~/raem/schema/TransientFields";
import Resource, { resourceInterface } from "~/raem/schema/Resource";
import Sprite from "~/raem/schema/Sprite";

const INTERFACE_DESCRIPTION = "this presentable content";

export function representationInterface (objectDescription: string = INTERFACE_DESCRIPTION) {
  return {
    name: "Representation",

    description: `A connection between a particular localization configuration and a single
undivisible piece of presentable content, given as collection of data in different forms.
`,

    interfaces: () => [Resource, TransientFields],

    fields: () => ({
      ...resourceInterface(objectDescription).fields(),

      ...primaryField("textual", GraphQLString,
          `Textual form of content localization for ${objectDescription}`,
      ),

      ...primaryField("aural", Sprite,
          `Aural form of content localization for ${objectDescription}`,
      ),

      ...primaryField("visual", Sprite,
          `Visual form of content localization for ${objectDescription}`,
      ),
    }),

    resolveType: typeNameResolver,
  };
}

const Representation = new GraphQLInterfaceType(representationInterface());

export default Representation;
