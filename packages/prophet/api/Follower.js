/**
 * Interface for prophecies flowing downstream
 */
export default class Follower {

  /**
   * revealProphecy - reveal prophecy event ie. uncertain future event.
   *
   * @param  {type} event          uncertain future event
   * @param  {type} timed          time context of the event
   * @param  {type} state          current state of knowledge after prophecy
   * @param  {type} previousState  state of knowledge before prophecy
   * @returns {type}               if this prophecy originates from a local proclaim call, any
   *                               return values are returned back to the proclaim inside promises.
   *                               This is to facilitate more complex interactive logic (such as UI
   *                               interactions) in a straightforward async/await fashion.
   */
  revealProphecy (prophecy: Prophecy): ?Promise<any>[] {} // eslint-disable-line

  /**
   * receiveTruth - confirm an earlier prophecy as true
   *
   * @param  {type} truthEvent   earlier prophecy confirmed as truth ie. part of knowledge
   * @returns {type}             description
   */
  receiveTruth (truthEvent) {} // eslint-disable-line

  /**
   * rejectHeresy - reject an earlier prophecy as false, resetting the corpus to state before it.
   *
   * @param  {type} hereticEvent  earlier prophecy rejected as heresy ie. not part of knowledge
   * @param  {type} purgedCorpus  state of knowledge before the heresy
   * @param  {type} revisedEvents list of earlier prophecies whose changes were purged from the
   *                              corpus and which are going to be revised ie. revealed again.
   * @returns {type}              description
   */
  rejectHeresy (hereticEvent, purgedCorpus, revisedEvents) {} // eslint-disable-line
}
