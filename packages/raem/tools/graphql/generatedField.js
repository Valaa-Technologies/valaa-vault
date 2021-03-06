import { toNone } from "~/raem/tools/graphql/coupling";

import commonFieldInfos from "~/raem/tools/graphql/commonFieldInfos";

export default function generatedField (targetFieldName, type, description, generator,
    additionalDescriptors = {}) {
  // TODO(iridian): Define generated field semantics with some actual thought.
  return {
    [targetFieldName]: {
      ...commonFieldInfos(targetFieldName, type, description),
      coupling: toNone(),
      isGenerated: true,
      resolve: generator,
      ...additionalDescriptors,
    },
  };
}
