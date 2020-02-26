// @flow

import { denoteValOSBuiltinWithSignature } from "~/raem/VALK";

import globalHTML5BuiltinObjects from "./globalHTML5BuiltinObjects";
import extendValOSWithInspire from "./valos";

export default function extendValosheathWithInspire (scope: Object,
    hostDescriptors: any, hostGlobal: Object, defaultAuthorityConfig?: Object, engine?: Object) {
  Object.assign(scope, globalHTML5BuiltinObjects(hostGlobal));
  extendValOSWithInspire(scope, hostDescriptors);

  let RemoteAuthorityURI = null;
  let getChronicleIndexEntityCall = function getChronicleIndexEntity () {
    throw new Error(`Cannot locate chronicle index entity; Inspire view configuration${
        ""} doesn't specify defaultAuthorityURI`);
  };

  if (defaultAuthorityConfig) {
    RemoteAuthorityURI = defaultAuthorityConfig.authorityURI
        || defaultAuthorityConfig.partitionAuthorityURI;
    getChronicleIndexEntityCall = function getChronicleIndexEntity () {
      return engine.tryVrapper(defaultAuthorityConfig.repositoryIndexId);
    };
  }

  scope.valos.InspireGateway = scope.valos.GatewayConfig = {
    RemoteAuthorityURI,
    LocalAuthorityURI: "valaa-local:",
    getPartitionIndexEntity: denoteValOSBuiltinWithSignature(
      `Returns the chronicle corresponding to the chronicle index.`
    )(getChronicleIndexEntityCall),
  };
}
