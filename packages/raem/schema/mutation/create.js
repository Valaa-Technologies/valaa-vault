import { GraphQLString, GraphQLObjectType, GraphQLInputObjectType, GraphQLNonNull }
    from "graphql/type";

import mutationInputField from "~/raem/tools/graphql/mutationInputField";
import mutationPayloadField from "~/raem/tools/graphql/mutationPayloadField";
import created from "~/raem/events/created";

const CreateMutationInput = new GraphQLInputObjectType({
  name: "CreateMutationInput",
  fields: {
    ...mutationInputField("clientMutationId", new GraphQLNonNull(GraphQLString)),
    ...mutationInputField("id", new GraphQLNonNull(GraphQLString)),
    ...mutationInputField("typeName", new GraphQLNonNull(GraphQLString)),
    ...mutationInputField("initialState", GraphQLString),
  },
});

const CreateMutationPayload = new GraphQLObjectType({
  name: "CreateMutationPayload",
  fields: {
    ...mutationPayloadField("clientMutationId", new GraphQLNonNull(GraphQLString)),
  },
});

const create = {
  type: CreateMutationPayload,
  description: "Elementary create resource",
  args: {
    input: { type: new GraphQLNonNull(CreateMutationInput) },
  },
  resolve: async (context, args/* , info */) => {
    try {
      const truth = await context.store.proclaimEvent({
        ...created({
          id: args.input.id,
          typeName: args.input.typeName,
          initialState: args.input.initialState && JSON.parse(args.input.initialState),
        }),
        bvobStubs: context.bvobStubs,
      }).getTruthEvent();
      return {
        clientMutationId: truth.id,
      };
    } catch (error) {
      console.error(error.message, error.stack);
      throw error;
    }
  },
};

export default create;
