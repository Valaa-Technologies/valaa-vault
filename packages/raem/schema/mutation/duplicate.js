import { GraphQLString, GraphQLObjectType, GraphQLInputObjectType, GraphQLNonNull }
    from "graphql/type";

import mutationInputField from "~/raem/tools/graphql/mutationInputField";
import mutationPayloadField from "~/raem/tools/graphql/mutationPayloadField";
import duplicated from "~/raem/command/duplicated";

const DuplicateMutationInput = new GraphQLInputObjectType({
  name: "DuplicateMutationInput",
  fields: {
    ...mutationInputField("clientMutationId", new GraphQLNonNull(GraphQLString)),
    ...mutationInputField("id", new GraphQLNonNull(GraphQLString)),
    ...mutationInputField("duplicateOf", GraphQLString),
    ...mutationInputField("initialState", GraphQLString),
  },
});

const DuplicateMutationPayload = new GraphQLObjectType({
  name: "DuplicateMutationPayload",
  fields: {
    ...mutationPayloadField("clientMutationId", new GraphQLNonNull(GraphQLString)),
  },
});

const duplicate = {
  type: DuplicateMutationPayload,
  description: "Elementary duplicate resource",
  args: {
    input: { type: new GraphQLNonNull(DuplicateMutationInput) },
  },
  resolve: async (context, args/* , info */) => {
    const proclamation = await context.store.dispatch(duplicated({
      id: args.input.id,
      duplicateOf: JSON.parse(args.input.duplicateOf),
      initialState: args.input.initialState && JSON.parse(args.input.initialState),
    }));
    return {
      clientMutationId: proclamation.id,
    };
  },
};

export default duplicate;
