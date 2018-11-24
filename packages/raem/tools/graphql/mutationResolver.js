// @flow

import denormalizedFromJS from "~/raem/state/denormalizedFromJS";


/**
 * Incoming mutations have their source datas expressed as plain JS objects: this field resolver
 * decorator converts these into denormalized form so that standard resolvers can process them.
 *
 * @export
 * @param {any} resolver
 * @returns
 */
export default function mutationResolver (resolver) {
  return (source, args, context) => resolver(denormalizedFromJS(source), args, context);
}
