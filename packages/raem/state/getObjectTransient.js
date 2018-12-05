// @flow

import ValaaReference, { IdData } from "~/raem/ValaaReference";
import { Resolver, State, Transient } from "~/raem/state";

import { dumpObject, wrapError } from "~/tools";

/**
 * Returns a transient which corresponds to given idData and typeName in given state.
 * If a transient for the idData raw id is not found and the idData has a ghostPath, the path is
 * traversed and most derived materialized transient will be returned. In this case the transient id
 * is overridden to be the requested id and transient[PrototypeOfImmaterialTag] is set to the most
 * inherited materialized prototype transient.
 *
 * idData :[id :string, ghostPath, coupledField :string]
 * ghostPath :Map<hostPrototypeRawId, [ghostHostId, optional<ghostId>]>
 */
export default function getObjectTransient (stateOrResolver: State, idData: IdData,
    typeName: string, require: boolean = true): Transient {
  const resolver = stateOrResolver.obtainReference
      ? stateOrResolver
      : new Resolver({ state: stateOrResolver, logger: console });
  return getObjectTransientDetailed(resolver, resolver.obtainReference(idData), typeName, require);
}

/**
 * Like getObjectTransient but with require as false.
 * Returns undefined if no idData is given. Returns null if no transient was found.
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
export function tryObjectTransient (stateOrResolver: State, idData: IdData, typeName: string):
    Transient {
  return getObjectTransient(stateOrResolver, idData, typeName, false);
}

export function getObjectTransientDetailed (resolver: Resolver, id: ValaaReference,
    typeName: string, require: boolean = true,
    mostMaterialized: ?any, withOwnField?: string): Transient {
  try {
    if (!(resolver instanceof Resolver)) {
      throw new Error("INTERNAL ERROR: getObjectTransientDetailed.resolver is not a Resolver");
    }
    return resolver.tryGoToObjectIdTransient(
        id, typeName, require, false, mostMaterialized, withOwnField);
  } catch (error) {
    throw wrapError(error, `During getObjectTransientDetailed(${id}: ${typeName}), with:`,
        "\n\trequire:", require,
        "\n\tmostMaterialized:", mostMaterialized,
        "\n\twithOwnField:", withOwnField,
        "\n\tresolver:", ...dumpObject(resolver));
  }
}
