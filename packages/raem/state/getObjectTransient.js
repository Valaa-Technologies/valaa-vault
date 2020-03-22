// @flow

import { IdData } from "~/raem/VRL";
import { Resolver, Transient } from "~/raem/state";

/**
 * Returns a transient which corresponds to given idData and typeName
 * in the given state or resolver.
 * If a transient for the idData raw id is not found and the idData has
 * a ghostPath, the path is traversed and most derived materialized
 * transient will be returned. In this case the transient id is
 * overridden to be the requested id and
 * transient[PrototypeOfImmaterialTag] is set to the most inherited
 * materialized prototype transient.
 *
 * idData :[id :string, ghostPath, coupledField :string]
 * ghostPath :Map<hostPrototypeRawId, [ghostHostId, optional<ghostId>]>
 */
export function tryObjectTransient (resolver: Resolver, idData: IdData, typeName: string,
    require: boolean = false): Transient {
  if (!(resolver instanceof Resolver)) {
    throw new Error("INTERNAL ERROR: getObjectTransientDetailed.resolver is not a Resolver");
  }
  return resolver.tryGoToTransient(resolver.obtainReference(idData), typeName, require, false);
}
