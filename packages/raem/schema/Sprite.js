// @flow
import { GraphQLInterfaceType, GraphQLFloat, GraphQLNonNull } from "graphql/type";

import generatedField from "~/raem/tools/graphql/generatedField";
import primaryField from "~/raem/tools/graphql/primaryField";

import constantResolver from "~/raem/tools/graphql/constantResolver";
import dataObjectResolver from "~/raem/tools/graphql/dataObjectResolver";
import immutableResolver from "~/raem/tools/graphql/immutableResolver";
import { typeNameResolver } from "~/raem/tools/graphql/typeResolver";

import Discoverable, { discoverableInterface } from "~/raem/schema/Discoverable";
import TransientFields from "~/raem/schema/TransientFields";
import Position from "~/raem/schema/Position";
import Resource from "~/raem/schema/Resource";

const INTERFACE_DESCRIPTION = "sprite";

export function spriteInterface (objectDescription: string = INTERFACE_DESCRIPTION) {
  const spriteFieldsAny = spriteFieldsAnyExcept(objectDescription);
  return {
    name: "Sprite",

    description:
`  *Abstract spatio-temporal media view relation*; a building block for higher level components.
Sprite represents a view into raw Media data as well a transformation into being part of a whole.
For example an Animation is can be purely defined as an unordered set of sprites. All content
information for the Animation is contained within the individual sprites; a start time and duration
as well as the region of the animation it occupies.

More complex Animation's might comprise of combined visual and aural sprites, as well as partially
overlapping sprites. More advanced AnimationSprite might contain Animation's themselves allowing
for higher level recursive composition of Animation's. TransformationSprite would allow for complex
spatial and temporal transformations between the source data and the target container.
`,

    interfaces: () => [Discoverable, Resource, TransientFields],

    fields: () => ({
      ...discoverableInterface(objectDescription).fields(),

      start: spriteFieldsAny.start,
      duration: spriteFieldsAny.duration,
      origin: spriteFieldsAny.origin,
      dimensions: spriteFieldsAny.dimensions,
    }),

    resolveType: typeNameResolver,
  };
}

export const REQUIRED = {};

const spriteFields = {
  start: {
    required: (objectDescription: string) => ({
      type: new GraphQLNonNull(GraphQLFloat),
      description: `Start time (in seconds) of this ${objectDescription}`,
      resolve: immutableResolver,
    }),
    constant: (objectDescription: string, value: number) => ({
      type: GraphQLFloat,
      description: `Start time (in seconds) of this ${objectDescription} is always immutably ${
          JSON.stringify(value)}`,
      resolve: constantResolver(value),
    }),
    any: (objectDescription: string) => ({
      type: GraphQLFloat,
      description: `Start time (in seconds) of the ${objectDescription
          } or null if not temporal`,
      resolve: immutableResolver,
    }),
  },

  duration: {
    required: (objectDescription: string) => ({
      type: new GraphQLNonNull(GraphQLFloat),
      description: `Duration (in seconds) of this ${objectDescription}`,
      resolve: immutableResolver,
    }),
    constant: (objectDescription: string, value: number) => ({
      type: GraphQLFloat,
      description: `Duration (in seconds) of this ${objectDescription} is always immutably ${
          JSON.stringify(value)}`,
      resolve: constantResolver(value),
    }),
    any: (objectDescription: string) => ({
      type: GraphQLFloat,
      description: `Duration (in seconds) of this ${objectDescription} or null if not temporal`,
      resolve: immutableResolver,
    }),
  },

  origin: {
    required: (objectDescription: string) => ({
      type: new GraphQLNonNull(Position),
      description: `Spatial origin of this ${objectDescription}`,
      resolve: dataObjectResolver,
    }),
    constant: (objectDescription: string, value: number) => ({
      type: Position,
      description: `Spatial origin of this ${objectDescription} is always immutably ${
          JSON.stringify(value)}`,
      resolve: constantResolver(value),
    }),
    any: (objectDescription: string) => ({
      type: Position,
      description: `Spatial origin of this ${objectDescription} or null if not spatial`,
      resolve: dataObjectResolver,
    }),
  },

  dimensions: {
    required: (objectDescription: string) => ({
      type: new GraphQLNonNull(Position),
      description: `Spatial dimensions of this ${objectDescription}`,
      resolve: dataObjectResolver,
    }),
    constant: (objectDescription: string, value: number) => ({
      type: Position,
      description: `Spatial dimensions of this ${objectDescription} are always immutably ${
          JSON.stringify(value)}`,
      resolve: constantResolver(value),
    }),
    any: (objectDescription: string) => ({
      type: Position,
      description: `Spatial dimensions of this ${objectDescription} or null if not spatial`,
      resolve: dataObjectResolver,
    }),
  },
};

export function spriteFieldsNullExcept (objectDescription: string,
    options: { required?: ?any, constant?: ?any, any?: ?any } = {}) {
  return requiredConstantAnyOrDefaultFields(spriteFields, objectDescription,
      { ...options, defaultType: { constant: null } }
  );
}

export function spriteFieldsAnyExcept (objectDescription: string,
    options: { required?: ?any, constant?: ?any, any?: ?any } = {}) {
  return requiredConstantAnyOrDefaultFields(spriteFields, objectDescription,
      { ...options, defaultType: "any" }
  );
}

export function spriteFieldsRequiredExcept (objectDescription: string,
    options: { required?: ?any, constant?: ?any, any?: ?any } = {}) {
  return requiredConstantAnyOrDefaultFields(spriteFields, objectDescription,
      { ...options, defaultType: "required" }
  );
}

export function requiredConstantAnyOrDefaultFields (fieldsLookup: Object, objectDescription: string,
    { required = {}, constant = {}, any = {}, defaultType = "any" }: any = {}) {
  return Object.keys(fieldsLookup).reduce((object, key) => {
    const type = (key in required) ? "required"
        : (key in constant) ? { constant: constant.key }
        : (key in any) ? "any"
        : defaultType;
    let fieldIntroBlock;
    if (typeof type === "object") {
      const fieldIntro = fieldsLookup[key].constant(objectDescription, type.constant);
      fieldIntroBlock = generatedField(key, fieldIntro.type, fieldIntro.description,
          fieldIntro.resolve);
    } else {
      const fieldIntro = fieldsLookup[key][type](objectDescription);
      fieldIntroBlock = primaryField(key, fieldIntro.type, fieldIntro.description,
          { resolve: fieldIntro.resolve });
    }
    Object.assign(object, fieldIntroBlock);
    return object;
  }, {});
}

export default new GraphQLInterfaceType(spriteInterface());
