import Valker from "~/raem/VALK/Valker";

import type { ProphecyEventResult } from "~/sourcerer/api/types";

/**
 * Discourse is a fancy name for a two-directional communication
 * channel between a single Sourcerer and a single Follower.
 * It is optimistic: downstream events can be either confirmed truths
 * or unconfirmed optimistic commands.
 * It is chronicle agnostic: downstream events can be multi-chronicle
 * and it can fabricate multi-chronicle commands towards upstream.
 * It manages an the identities of the Follower towards the sourcerer
 * fabric.
 *
 * @export
 * @class Discourse
 * @extends {Valker}
 */
export default class Discourse extends Valker {
  static isDiscourse = true;

  getFollower () { return this._parent; }

  obtainId (rawId: string): VRL { // eslint-disable-line
    throw new Error(`${this.constructor.name}/Discourse.obtainId not implemented`);
  }

  getIdentityManager (): Object {
    throw new Error(`${this.constructor.name}/Discourse.getIdentityManager not implemented`);
  }

  /**
   * assignNewVRID - Creates a new resource id and assigns it to targetAction.
   *
   * @returns {type} a new id for the object
   */
  assignNewVRID (targetAction: EventBase, chronicleURI: string): VRL { // eslint-disable-line
    throw new Error(`${this.constructor.name}/Discourse.assignNewVRID not implemented`);
  }

  /**
   * assignNewChronicleRootId - Creates a new chronicle id and assigns it to targetAction.
   *
   * @returns {type} chronicleURI
   */
  assignNewChronicleRootId (targetAction: EventBase, authorityURI: string): ValaaURI { // eslint-disable-line
    throw new Error(`${this.constructor.name}/Discourse.assignNewChronicleRootId not implemented`);
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
   * acquireFabricator - Creates a transaction object for grouping
   * resource manipulations together.
   * @returns {Discourse}  transaction object
   */
  acquireFabricator (name: string): Discourse {
    throw new Error(
        `${this.constructor.name}/Discourse.acquireFabricator(${name}) not implemented`);
  }
}
