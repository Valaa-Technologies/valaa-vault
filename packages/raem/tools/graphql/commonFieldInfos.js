import { GraphQLObjectType, getNamedType, isLeafType, isCompositeType, GraphQLList }
    from "graphql/type";

import isResourceType from "~/raem/tools/graphql/isResourceType";

export default function commonFieldInfos (fieldName: string, type: GraphQLObjectType,
    description: string) {
  const namedType = getNamedType(type);
  const isLeaf = isLeafType(namedType);
  return {
    fieldName,
    type,
    description,
    namedType,
    isSequence: type instanceof GraphQLList,
    isLeaf,
    isComposite: isCompositeType(namedType),
    isResource: !isLeaf && isResourceType(namedType),
    isData: !isLeaf && !isResourceType(namedType),
    isBvob: namedType.name === "Blob",
    isPackable: !isLeaf && (namedType.name !== "Blob"),
  };
}
