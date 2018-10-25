// @flow

import ValaaURI from "~/raem/ValaaURI";

import Prophet, { ConnectOptions } from "~/prophet/api/Prophet";

import { dumpObject, thenChainEagerly } from "~/tools";

import type Oracle from "./Oracle";
import type OraclePartitionConnection from "./OraclePartitionConnection";

export function _acquirePartitionConnection (oracle: Oracle, partitionURI: ValaaURI,
    options: ConnectOptions) {
  if (options.newPartition || options.onlyTrySynchronousConnection) {
    const connection = oracle._connections[String(partitionURI)];
    if (options.onlyTrySynchronousConnection) return connection;
    if (connection && connection.getFirstUnusedTruthEventId()) {
      throw new Error(`Partition already exists when trying to create a new partition '${
          String(partitionURI)}'`);
    }
  }
  const authorityProphet = oracle._authorityNexus.obtainAuthorityProphetOfPartition(partitionURI);
  if (!authorityProphet) {
    throw new Error(`Can't obtain authority for partition URI '${partitionURI}'`);
  }
  const ret = Prophet.prototype.acquirePartitionConnection.call(oracle, partitionURI, {
    ...options, createConnectionOptions: { authorityProphet }
  });

  if (!ret || (!ret.isSynced() && (options.allowPartialConnection === false))) return undefined;
  // oracle.logEvent("acquirePC:", partitionURI, ...dumpObject(options),
  //    "\n\tret:", ...dumpObject(ret));
  return ret;
}

export function _connect (connection: OraclePartitionConnection, options: ConnectOptions,
    onError: Function) {
  connection.warnEvent(1, "\n\tBegun initializing connection with options",
      ...dumpObject(options), ...dumpObject(connection));
  // Handle step 1. of the acquirePartitionConnection first narration logic (defined
  // in PartitionConnection.js) and begin I/O bound scribe event log narration in parallel to
  // the authority proxy/connection creation.
  const upstreamConnection = connection._authorityProphet.acquirePartitionConnection(
      connection.getPartitionURI(), {
        subscribe: false, narrateOptions: false,
        receiveTruths: connection.getReceiveTruths(options.receiveTruths),
      });
  connection.setUpstreamConnection(upstreamConnection);
  return thenChainEagerly(upstreamConnection.getSyncedConnection(), [
    () => connection.narrateEventLog(options.narrateOptions),
    (narration) => {
      if (!narration) return;
      const actionCount = Object.values(narration).reduce(
          (s, log) => s + (Array.isArray(log) ? log.length : 0),
          options.firstEventId || 0);
      // FIXME(iridian): These validations are in a totally wrong place. Should be way higher in the
      // call chain.
      if (!actionCount && (options.newPartition === false)) {
        throw new Error(`No events found when connecting to an expected existing partition '${
          connection.getPartitionURI().toString()}'`);
      } else if (actionCount && (options.newPartition === true)) {
        throw new Error(`Existing events found when trying to create a new partition '${
          connection.getPartitionURI().toString()}'`);
      }
      if ((options.requireLatestMediaContents !== false)
          && (narration.mediaRetrievalStatus || { latestFailures: [] }).latestFailures.length) {
        // FIXME(iridian): This error temporarily demoted to log error
        connection.outputErrorEvent(new Error(`Failed to connect to partition: encountered ${
          narration.mediaRetrievalStatus.latestFailures.length
            } latest media content retrieval failures (and acquirePartitionConnection.${
            ""}options.requireLatestMediaContents does not equal false).`));
      }
      connection.warnEvent(1, "\n\tDone initializing connection with options", options,
          "\n\tinitial narration:", narration);
    },
    () => connection,
  ], onError);
}
