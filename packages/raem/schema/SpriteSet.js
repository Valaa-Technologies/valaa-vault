// @flow
import { GraphQLInterfaceType, GraphQLList } from "graphql/type";
import primaryField from "~/raem/tools/graphql/primaryField";
import { typeNameResolver } from "~/raem/tools/graphql/typeResolver";
import { toManyOwnlings } from "~/raem/tools/graphql/coupling";

import TransientFields from "~/raem/schema/TransientFields";
import Resource, { resourceInterface } from "~/raem/schema/Resource";

import Sprite from "./Sprite";

const INTERFACE_DESCRIPTION = "sprite set";

export function spriteSetInterface (objectDescription: string = INTERFACE_DESCRIPTION) {
  return {
    name: "SpriteSet",

    interfaces: () => [Resource, TransientFields],

    fields: () => ({
      ...resourceInterface(objectDescription).fields(),

      ...primaryField("sprites", new GraphQLList(Sprite),
          `Sprites that make this ${objectDescription}`,
          { coupling: toManyOwnlings() },
      ),
    }),

    resolveType: typeNameResolver,
  };
}

export default new GraphQLInterfaceType(spriteSetInterface());
