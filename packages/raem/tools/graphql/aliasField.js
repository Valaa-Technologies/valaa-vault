import commonFieldInfos from "~/raem/tools/graphql/commonFieldInfos";

export default function aliasField (fieldName, targetFieldName, type, description,
    additionalDescriptors = {}) {
  /*
  if (!additionalDescriptors.coupling) {
    throw new Error(`Alias (here for '${targetFieldName
        }') not supported for fields with no coupling`);
  }
  */
  if (additionalDescriptors.initialValue !== undefined) {
    throw new Error(`Alias fields (here for '${targetFieldName}') cannot have initial values`);
    // ...at least before they have use cases which warrant the added complexity.
  }
  return {
    [fieldName]: {
      ...commonFieldInfos(fieldName, type, `${description}. Alias for field '${targetFieldName}'`),
      alias: targetFieldName,
      isAlias: true,
      coupling: {
        ...additionalDescriptors.coupling,
        alias: targetFieldName,
      },
      ...additionalDescriptors,
    }
  };
}
