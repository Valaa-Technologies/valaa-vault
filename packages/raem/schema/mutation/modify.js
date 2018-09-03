import { GraphQLString, GraphQLObjectType, GraphQLInputObjectType, GraphQLNonNull }
    from "graphql/type";

import mutationInputField from "~/raem/tools/graphql/mutationInputField";
import mutationPayloadField from "~/raem/tools/graphql/mutationPayloadField";
import modified from "~/raem/command/modified";

const ModifyMutationInput = new GraphQLInputObjectType({
  name: "ModifyMutationInput",
  fields: {
    ...mutationInputField("clientMutationId", new GraphQLNonNull(GraphQLString)),
    ...mutationInputField("id", new GraphQLNonNull(GraphQLString)),
    ...mutationInputField("typeName", new GraphQLNonNull(GraphQLString)),
    ...mutationInputField("sets", GraphQLString),
    ...mutationInputField("adds", GraphQLString),
    ...mutationInputField("removes", GraphQLString),
    ...mutationInputField("splices", GraphQLString),
  },
});

const ModifyMutationPayload = new GraphQLObjectType({
  name: "ModifyMutationPayload",
  fields: {
    ...mutationPayloadField("clientMutationId", new GraphQLNonNull(GraphQLString)),
  },
});

const modify = {
  type: ModifyMutationPayload,
  description: "Elementary modify resource properties",
  args: {
    input: { type: new GraphQLNonNull(ModifyMutationInput) },
  },
  resolve: async (context, args/* , info */) => {
    try {
      const command = await context.store.dispatch({
        ...modified({
          id: args.input.id,
          typeName: args.input.typeName,
          sets: args.input.sets && JSON.parse(args.input.sets),
          adds: args.input.adds && JSON.parse(args.input.adds),
          removes: args.input.removes && JSON.parse(args.input.removes),
          splices: args.input.splices && JSON.parse(args.input.splices),
        }),
        bvobStubs: context.bvobStubs,
      });
      return {
        clientMutationId: command.id,
      };
    } catch (error) {
      console.error(error.message, error.stack);
      throw error;
    }
  },
};

export default modify;
