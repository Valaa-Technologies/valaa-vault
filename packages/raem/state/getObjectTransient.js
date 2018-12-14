// @flow

import { IdData } from "~/raem/ValaaReference";
import { Resolver, State, Transient } from "~/raem/state";

import { dumpObject, wrapError } from "~/tools";

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
 *
 * @export
 * @param {State} state
 * @param {IdData} idData
 * @param {string} typeName
 * @param {Object} logger
 * @param null objectTable
 * @param {any} Object
 * @returns {Transient}
 */
export function tryObjectTransient (resolver: Resolver, idData: IdData, typeName: string,
    require: boolean = false): Transient {
  try {
    if (!(resolver instanceof Resolver)) {
      throw new Error("INTERNAL ERROR: getObjectTransientDetailed.resolver is not a Resolver");
    }
    return resolver.tryGoToTransient(resolver.obtainReference(idData), typeName, require, false);
  } catch (error) {
    throw wrapError(error, `During getObjectTransientDetailed(${idData}: ${typeName}), with:`,
        "\n\trequire:", require,
        "\n\tresolver:", ...dumpObject(resolver));
  }
}
