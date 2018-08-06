import Valker from "~/raem/VALK/Valker";

import type { ClaimResult } from "~/prophet/api/Prophet";

/**
 * Discourse is a fancy name for a one-to-one communication connection between a single Prophet and
 * a single Follower.
 */
export default class Discourse extends Valker {
  static isDiscourse = true;

  /**
   * createId - Creates an id based on given mutation parameters and options.
   *
   * @param  {type} mutationParams mutation parameters like for CreateMutation
   * @param  {type} options { immutableType } for different id creation schema for immutables
   * @returns {type} a new id for the object
   */
  createId (mutationParams): VRef { // eslint-disable-line
    throw new Error(`${this.constructor.name}/Discourse.createId unimplemented`);
  }

  /**
   * run - Run given kuery starting from given head. See @valos/raem/VALK
   *
   * @param  {type} kuery           description
   * @param  {type} state           description
   * @returns {type}                description
   */
  // run (head, kuery, options): any {
  //  return super.run(head, kuery, options);
  // }

  /**
   * transaction - Creates a transaction object for grouping resource manipulations together.
   * @returns {Discourse}  transaction object
   */
  transaction (): Discourse {
    throw new Error(`${this.constructor.name}/Discourse.transaction unimplemented`);
  }

  /**
   * create - Creates an object and returns a Promise to a the newly created object.
   * If inside transaction the promise resolves immediately to optimistic content,
   * if outside transaction the promise will wait for the result.
   *
   * @param  {type} typeName  description
   * @param  {type} owner         target owner to create the resource for
   * @param  {type} duplicateOf   duplicate source resource to copy owned fields from
   * @param  {type} initialState  overriding initial properties (over duplicate)
   * @param  {type} id            description
   * @returns {ClaimResult}       prophecy will return the optimistically
   *                              filled event of the created/duplicated resource immediately as
   *                              given to create.
   */
  create ({ typeName, initialState, id }): ClaimResult { // eslint-disable-line
    throw new Error(`${this.constructor.name}/Discourse.create unimplemented`);
  }

  /**
   * duplicate - alias for create which asserts that duplicate is specified and extracts the owner
   * from it.
   */
  duplicate ({ duplicateOf, initialState, id }): ClaimResult { // eslint-disable-line
    throw new Error(`${this.constructor.name}/Discourse.duplicate unimplemented`);
  }

  /**
   * modify - Modifies an object and returns a Promise to the resource view after modification.
   * TODO(iridian): Add docs, similar to create
   *
   * @param  {type} id           description
   * @param  {type} typeName description
   * @param  {type} sets         description
   * @param  {type} adds         description
   * @param  {type} removes      description
   * @param  {type} splices      description
   * @returns {ClaimResult}      description
   */
  modify ({ id, typeName, sets, adds, removes, splices }): ClaimResult { // eslint-disable-line
    throw new Error(`${this.constructor.name}/Discourse.modify unimplemented`);
  }

  /**
   * destroy - Destroys a resource
   *
   * @param  {type} id           description
   * @param  {type} typeName description
   * @returns {ClaimResult}      description
   */
  destroy ({ id, typeName }): ClaimResult { // eslint-disable-line
    throw new Error(`${this.constructor.name}/Discourse.destroy unimplemented`);
  }
}
