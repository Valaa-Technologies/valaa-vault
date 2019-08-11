import commonFieldInfos from "~/raem/tools/graphql/commonFieldInfos";
import immutableResolver from "~/raem/tools/graphql/immutableResolver";
import linkResolver from "~/raem/tools/graphql/linkResolver";
import listLinkResolver from "~/raem/tools/graphql/listLinkResolver";

import invariantify from "~/tools/invariantify";

/**
 * Field information section for a primary field, ie. a field which is persisted.
 *
 * @export
 * @param {any} targetFieldName
 * @param {any} type
 * @param {any} description
 * @param {any} [additionalDescriptors={}]
 * @returns
 */
export default function primaryField (targetFieldName, type, description,
    additionalDescriptors = {}) {
  invariantify(type, "primaryField.type");
  const common = commonFieldInfos(targetFieldName, type, description);
  const ret = {
    [targetFieldName]: {
      ...common,
      resolve: common.isLeaf ? immutableResolver
          : common.isSequence ? listLinkResolver
          : linkResolver,
      isPrimary: true,
      isWritable: true,
      isPersisted: true,
      isDuplicateable: true,
      isOwnerOf: additionalDescriptors.coupling && additionalDescriptors.coupling.isOwnerOf,
      isOwnedBy: additionalDescriptors.coupling && additionalDescriptors.coupling.isOwnedBy,
      ...additionalDescriptors,
    },
  };
  return ret;
}
