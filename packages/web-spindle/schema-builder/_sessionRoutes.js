// @flow

import { wrapError, dumpObject } from "~/tools";

import { StringType, XWWWFormURLEncodedStringType } from "./types";

import { _setupRoute, _routeName } from "./_routesCommon";

export function sessionGETRoute (url, userConfig, globalRules) {
  const route = { url, projector: "session", method: "GET", config: {
    rules: {
      grantExpirationDelay: 60,
      tokenExpirationDelay: 86400,
      userAgentState: ["@!:request:cookies", ["@!:identity:clientCookieName"]],
      authorizationGrant: ["@!:request:query:code"],
      grantProviderState: ["@!:request:query:state"],
      error: ["@!:request:query:error"],
      errorDescription: ["@!:request:query:error_description"],
      errorURI: ["@!:request:query:error_uri"],
    },
  } };
  try {
    if (!_setupRoute(route, userConfig, globalRules)) {
      return undefined;
    }
    Object.assign(route.schema, {
      description: `Get a session redirection via a ValOS OpenId Connect authorization response`,
      querystring: {
        code: { ...XWWWFormURLEncodedStringType },
        state: { ...XWWWFormURLEncodedStringType },
        error: StringType, // ASCII,
        error_description: StringType,
        // Values for the "error_description" parameter MUST NOT include
        // characters outside the set %x20-21 / %x23-5B / %x5D-7E.
        error_uri: StringType,
        // Values for the "error_uri" parameter MUST conform to the
        // URI-reference syntax and thus MUST NOT include characters
        // outside the set %x21 / %x23-5B / %x5D-7E.
        ...(route.schema.querystring || {}),
      },
      response: {
        302: StringType,
        404: { type: "string" },
      },
    });
    return route;
  } catch (error) {
    throw wrapError(error, new Error(`sessionGETRoute(${_routeName(route)})`),
        "\n\troute:", ...dumpObject(route),
    );
  }
}

export function sessionPOSTRoute (url, userConfig, globalRules) {
  const route = { url, projector: "session", method: "POST", config: {
    rules: {
      tokenExpirationDelay: 7 * 86400,
      clientCookie: ["@!:request:cookies", ["@!:identity:clientCookieName"]],
      sessionCookie: ["@!:request:cookies", ["@!:identity:sessionCookieName"]],
    },
  } };
  try {
    if (!_setupRoute(route, userConfig, globalRules)) {
      return undefined;
    }
    Object.assign(route.schema, {
      description: `Refresh the session authorization grant`,
      response: {
        302: StringType,
        404: { type: "string" },
      },
    });
    return route;
  } catch (error) {
    throw wrapError(error, new Error(`sessionPOSTRoute(${_routeName(route)})`),
        "\n\troute:", ...dumpObject(route),
    );
  }
}

export function sessionDELETERoute (url, userConfig, globalRules) {
  const route = { url, projector: "session", method: "DELETE", config: {
    rules: {
      clientCookie: ["@!:request:cookies", ["@!:identity:clientCookieName"]],
      sessionCookie: ["@!:request:cookies", ["@!:identity:sessionCookieName"]],
    },
  } };
  try {
    if (!_setupRoute(route, userConfig, globalRules)) {
      return undefined;
    }
    Object.assign(route.schema, {
      description: `Close an active session specified by the client${
        ""} and session token cookies and also clear those cookies.`,
      response: {
        303: StringType,
        400: { type: "string" },
        404: { type: "string" },
      },
    });
    return route;
  } catch (error) {
    throw wrapError(error, new Error(`sessionDELETERoute(${_routeName(route)})`),
        "\n\troute:", ...dumpObject(route),
    );
  }
}
