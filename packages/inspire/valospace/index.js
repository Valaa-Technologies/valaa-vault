// @flow

import { denoteValOSBuiltinWithSignature } from "~/raem/VALK";

import globalHTML5BuiltinObjects from "./globalHTML5BuiltinObjects";
import extendValOSWithInspire from "./valos";

export default function extendValospaceWithInspire (scope: Object,
    hostObjectDescriptors: any, hostGlobal: Object,
    defaultAuthorityConfig?: Object, engine?: Object) {
  Object.assign(scope, globalHTML5BuiltinObjects(hostGlobal));
  extendValOSWithInspire(scope, hostObjectDescriptors);

  let RemoteAuthorityURI = null;
  let getPartitionIndexEntityCall = function getPartitionIndexEntity () {
    throw new Error(`Cannot locate partition index entity; Inspire view configuration${
        ""} doesn't specify defaultAuthorityURI`);
  };

  if (defaultAuthorityConfig) {
    RemoteAuthorityURI = defaultAuthorityConfig.partitionAuthorityURI;
    getPartitionIndexEntityCall = function getPartitionIndexEntity () {
      return engine.tryVrapper(defaultAuthorityConfig.repositoryIndexId);
    };
  }

  scope.valos.InspireGateway = scope.valos.GatewayConfig = {
    RemoteAuthorityURI,
    LocalAuthorityURI: "valaa-local:",
    getPartitionIndexEntity: denoteValOSBuiltinWithSignature(
      `Returns the partition corresponding to the partition index.`
    )(getPartitionIndexEntityCall),
  };
}
