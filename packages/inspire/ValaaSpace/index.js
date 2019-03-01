// @flow

import { denoteValaaBuiltinWithSignature } from "~/raem/VALK";

import globalHTML5BuiltinObjects from "./globalHTML5BuiltinObjects";
import extendValaaWithInspire from "./Valaa";

export default function extendValaaSpaceWithInspire (scope: Object,
    hostObjectDescriptors: any, hostGlobal: Object,
    defaultAuthorityConfig?: Object, engine?: Object) {
  Object.assign(scope, globalHTML5BuiltinObjects(hostGlobal));
  extendValaaWithInspire(scope, hostObjectDescriptors);

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

  scope.Valaa.InspireGateway = {
    RemoteAuthorityURI,
    LocalAuthorityURI: "valaa-local:",
    getPartitionIndexEntity: denoteValaaBuiltinWithSignature(
      `Returns the partition corresponding to the partition index.`
    )(getPartitionIndexEntityCall),
  };
}
