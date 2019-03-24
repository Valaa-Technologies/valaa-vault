// @flow
import { GraphQLObjectType, getNamedType } from "graphql/type";

export default function isResourceType (typeIntro: GraphQLObjectType) {
  let ret = typeIntro.__isValOSResource;
  if (typeof ret === "undefined") {
    let value = false;
    const intro = getNamedType(typeIntro);
    // Note! The _typeConfig is implementation specific dependency on graphql internal
    // implementation details. But as it stands, there's no other way to annotate interface
    // extension.
    const interfaces = intro.getInterfaces ? intro.getInterfaces()
        : typeof intro._typeConfig.interfaces === "function" ? intro._typeConfig.interfaces()
        : Array.isArray(intro._typeConfig.interfaces) ? intro._typeConfig.interfaces
        : [];
    if (intro.name === "TransientFields"
        || interfaces.find(iface => (iface.name === "TransientFields"))) {
      value = true;
    }
    ret = typeIntro.__isValOSResource = value;
  }
  return ret;
}
