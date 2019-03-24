import Valker from "~/raem/VALK/Valker";

import type { ProphecyEventResult } from "~/prophet/api/types";

/**
 * Discourse is a fancy name for a one-to-one communication connection between a single Prophet and
 * a single Follower.
 */
export default class Discourse extends Valker {
  static isDiscourse = true;

  obtainId (rawId: string): VRL { // eslint-disable-line
    throw new Error(`${this.constructor.name}/Discourse.obtainId not implemented`);
  }

  /**
   * assignNewResourceId - Creates a new resource id and assigns it to targetAction.
   *
   * @returns {type} a new id for the object
   */
  assignNewResourceId (targetAction: EventBase, partitionURI: string): VRL { // eslint-disable-line
    throw new Error(`${this.constructor.name}/Discourse.assignNewResourceId not implemented`);
  }

  /**
   * assignNewPartitionId - Creates a new partition id and assigns it to targetAction.
   *
   * @returns {type} partitionURI
   */
  assignNewPartitionId (targetAction: EventBase, partitionAuthorityURI: string): ValaaURI { // eslint-disable-line
    throw new Error(`${this.constructor.name}/Discourse.assignNewPartitionId not implemented`);
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
    throw new Error(`${this.constructor.name}/Discourse.transaction not implemented`);
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
   * @returns {ProphecyEventResult} returns the ChronicleEventResults of the chronicling
   */
  create ({ typeName, initialState, id }): ProphecyEventResult { // eslint-disable-line
    throw new Error(`${this.constructor.name}/Discourse.create not implemented`);
  }

  /**
   * duplicate - alias for create which asserts that duplicate is specified and extracts the owner
   * from it.
   */
  duplicate ({ duplicateOf, initialState, id }): ProphecyEventResult { // eslint-disable-line
    throw new Error(`${this.constructor.name}/Discourse.duplicate not implemented`);
  }

  /**
   * destroy - Destroys a resource
   *
   * @param  {type} id           description
   * @param  {type} typeName     description
   * @returns {ProphecyEventResult} returns the ChronicleEventResults of the chronicling
   */
  destroy ({ id, typeName }): ProphecyEventResult { // eslint-disable-line
    throw new Error(`${this.constructor.name}/Discourse.destroy not implemented`);
  }
}
