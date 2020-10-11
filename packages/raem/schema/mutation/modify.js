import { GraphQLString, GraphQLObjectType, GraphQLInputObjectType, GraphQLNonNull }
    from "graphql/type";

import mutationInputField from "~/raem/tools/graphql/mutationInputField";
import mutationPayloadField from "~/raem/tools/graphql/mutationPayloadField";
// import modified from "~/raem/events/modified";

const ModifyMutationInput = new GraphQLInputObjectType({
  name: "ModifyMutationInput",
  fields: {
    ...mutationInputField("clientMutationId", new GraphQLNonNull(GraphQLString)),
    ...mutationInputField("id", new GraphQLNonNull(GraphQLString)),
    ...mutationInputField("typeName", new GraphQLNonNull(GraphQLString)),
    ...mutationInputField("sets", GraphQLString),
    ...mutationInputField("adds", GraphQLString),
    ...mutationInputField("removes", GraphQLString),
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
  resolve: async (/* context, args, info */) => {
    try {
      throw new Error("MODIFIED endpoint rotted - needs to be replaced with specific variants");
      /*
      const truth = await context.store.proclaimEvent({
        ...modified({
          id: args.input.id,
          typeName: args.input.typeName,
          sets: args.input.sets && JSON.parse(args.input.sets),
          adds: args.input.adds && JSON.parse(args.input.adds),
          removes: args.input.removes && JSON.parse(args.input.removes),
        }),
        bvobStubs: context.bvobStubs,
      }).getTruthEvent();
      return {
        clientMutationId: truth.id,
      };
      */
    } catch (error) {
      console.error(error.message, error.stack);
      throw error;
    }
  },
};

export default modify;
