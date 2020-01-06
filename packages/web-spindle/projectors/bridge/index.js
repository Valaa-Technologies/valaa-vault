// @flow

import createSimpleBridge from "./simpleBridge";
import createFullBridge from "./fullBridge";

export {
  createSimpleBridge as CONNECT,
  createFullBridge as DELETE,
  createSimpleBridge as GET,
  createSimpleBridge as HEAD,
  createSimpleBridge as OPTIONS,
  createFullBridge as PATCH,
  createFullBridge as POST,
  createFullBridge as PUT,
  createSimpleBridge as TRACE,
};
