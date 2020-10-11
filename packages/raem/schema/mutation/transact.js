import { GraphQLString, GraphQLObjectType, GraphQLInputObjectType, GraphQLNonNull }
    from "graphql/type";

import mutationInputField from "~/raem/tools/graphql/mutationInputField";
import mutationPayloadField from "~/raem/tools/graphql/mutationPayloadField";
import transacted from "~/raem/events/transacted";

const TransactMutationInput = new GraphQLInputObjectType({
  name: "TransactMutationInput",
  fields: {
    ...mutationInputField("clientMutationId", new GraphQLNonNull(GraphQLString)),
    ...mutationInputField("actions", new GraphQLNonNull(GraphQLString)),
  },
});

const TransactMutationPayload = new GraphQLObjectType({
  name: "TransactMutationPayload",
  fields: {
    ...mutationPayloadField("clientMutationId", new GraphQLNonNull(GraphQLString)),
  },
});

const transact = {
  type: TransactMutationPayload,
  description: "Elementary transact",
  args: {
    input: { type: new GraphQLNonNull(TransactMutationInput) },
  },
  resolve: async (context, args/* , info */) => {
    try {
      const command = transacted(JSON.parse(args.input.actions));
      command.bvobStubs = context.bvobStubs;
      const truth = await context.store.proclaimEvent(command).getTruthEvent();
      return { clientMutationId: truth.id };
    } catch (error) {
      console.error(error.message, error.stack);
      throw error;
    }
  },
};

export default transact;
