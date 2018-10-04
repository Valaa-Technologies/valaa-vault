// @flow

import { UniversalEvent } from "~/raem/command";

import PartitionConnection from "~/prophet/api/PartitionConnection";
import type { ConnectOptions } from "~/prophet/api/Prophet";

import {} from "~/tools";

/**
 * @export
 * @class FalseProphetPartitionConnection
 * @extends {PartitionConnection}
 */
export default class FalseProphetPartitionConnection extends PartitionConnection {
  _lastTruthId: number;
  _downstreamTruthQueue: Object[] = [];

  receiveEvent (truthEvent: UniversalEvent) {
    /*
      const pendingIndex = eventId - lastAuthorizedEventId - 1;
      if (pendingIndex >= 0 && !connection._downstreamTruthQueue[pendingIndex]) {
        connection._downstreamTruthQueue[pendingIndex] = { event, eventId, finalizers };
        const pendingMultiPartitionEvent = await _unwindSinglePartitionEvents(connection);
        if (pendingMultiPartitionEvent) {
          _tryConfirmPendingMultiPartitionTruths(connection._prophet, pendingMultiPartitionEvent);
        }
      }
    */
  }

  receiveCommand (reclaim: UniversalEvent) {

  }
}
