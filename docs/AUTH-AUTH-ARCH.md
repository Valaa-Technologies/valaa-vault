# Valaa Open System Authentication and Authorization Architecture

As of 2019-04 this document is WIP and only contains the single use
case description in section 1.


# 1. Case study: ValOS authentication and authorization of a traditional non-gateway web client application `vapp`

This section describes a single use case of an authentication and
authorization process (`auth-auth`) and how the
[OAuth2 specification][1] might be implemented within ValOS context.

A [tab][2] [explosion][3] of [useful][4] references were consulted.
Of special note is the [EdDSA][7] and its [Ed25519][8] implementation
within [TweetNaCL.js][9] ([see cure53 audit][10]).

[1]: https://tools.ietf.org/html/rfc6749
[2]: https://www.youtube.com/watch?v=67mezK3NzpU
[3]: https://gist.github.com/atoponce/07d8d4c833873be2f68c34f9afc5a78a
[4]: https://tools.ietf.org/html/rfc7516
[7]: https://tools.ietf.org/html/rfc8032
[8]: https://ed25519.cr.yp.to/
[9]: https://github.com/dchest/tweetnacl-js
[10]: https://cure53.de/tweetnacl.pdf

Even this section is still somewhat WIP, although all the core elements
are here.

## 1.1. Existing concepts

OAuth2 term definitions are used as follows:
- Section [oauth2-1.1](https://tools.ietf.org/html/rfc6749#section-1.1)
  definitions for `resource owner`, `end-user`, `resource server`,
  `client` are used as-is. `authorization server` is not used due to
  ambiguity with `token endpoint` semantics.
- Section [oauth2-3](https://tools.ietf.org/html/rfc6749#section-3)
  definitions for `authorization endpoint` and `token endpoint` are
  used but also considerably refined further. Most notably these roles
  are architecturally separated to different components: token endpoint
  and resource server roles are implemented by the same component which
  is different from the authorization endpoint.
- Section [oauth2-1](https://tools.ietf.org/html/rfc6749#section-1)
  definitions for `authorization request`, `authorization grant`,
  `authorization code`, `access token` are used as-is.
- Section [oauth2-1](https://tools.ietf.org/html/rfc6749#section-4.1)
  definition for `authorization code grant` is used. As it is also the
  only type of authorization grant used by this case study the other
  grant definitions are not inherited here either.

ValOS meanings (not well defined yet) are used for the following terms:
- `authority`, `partition`, `narrate`, `chronicle`, `perspire worker`,
  `identity service`, `crypto-resource-id`, `crypto-write-protection`,
  `event-crypto-auditing`

## 1.2. Agency roles

Agency roles are roles which add new types of interactions to the
system, have abstraction boundaries (ie. have an identity) and have
an agency; individuals, organizations or other similar emergent
phenomena.

The case study has four agent roles:
- the end-user
- the authority owner
- the identity service owner
- the client application owner

## 1.3. Component roles

Component roles are roles which add new interactions and have
abstraction boundaries but don't have an agency; software components,
infrastructure, standard processes, etc.

The case study has six main component roles: the `authority`,
the `vapp-worker`, the `vid-server`, the user-agent, the client
application and the login site.

### 1.3.1. The authority is a singular, standard ValOS authority

The authority hosts all the partitions necessary for the client
application as well as for all of its users.

### 1.3.2. The vapp-worker is a perspire worker

This worker is owned by the client application owner and it:
- implements valos site endpoint functionality for the client.
- provides a restricted restful API for the client application data.
- acts as the token endpoint as per [oauth2-3.2](https://tools.ietf.org/html/rfc6749#section-3.2)

### 1.3.3. The vid-server is an identity service

In this case study the identity service has been affiliated with the
client application. In the future architectures it is expected that the
identity service is more often affiliated with the user instead and
federated for the application.

### 1.3.4. The user-agent is a web browser

This browser is the one that the end-user interacts with to use the
client application (which is served by the vapp-worker). In addition
the end-user uses the user-agent to interact with the login site (which
is served by the vid-server).

### 1.3.5. The client application is a traditional non-valos single-page application

### 1.3.6. The login site is a trivial username/password login page

## 1.4. Changes to the system when the auth-auth is complete

The two main side-effects of a completed auth-auth flow are a new
session partition in the authority and a combination of cookie and
local storage state on the user-agent.

### 1.4.1. A new partition (`session partition`) exists within the authority

The session partition represents a conceptual session between the
end-user, the user-agent and the client application as a whole. The
session partition (and only it!) contains all persisted metadata,
revocation status, logging information and all similar data pertinent
to the session.

It is conceptually owned by the end-user but has shared write access to
it by the client application owner. This is implemented via
crypto-write-protection by an [Ed25519](https://tools.ietf.org/html/rfc8032)
key pair called `session-guard`. The session partition is registered
with the session-guard public key.

The vid-server has an active connection to this partition. Notably the
vapp-worker itself has no active connection to the session partition
(even though the client application owner could conceptually obtain the
access).

### 1.4.2. The user-agent has the access token as a JWT/JWE cookie

The access token contains the session data needed by the vapp-worker.
This token was authorized by the vid-server and prepared for the
user-agent by the vapp-worker. It contains the session partition id
which the worker adds as a multi-partition transaction target to all
authority modification commands. To enable stateless worker operations
the token also contains the session-guard private key which vapp-worker
will use to sign all commands.

The cookie has the `Secure; HttpOnly` flags to protect it against the
idiomatic `document.cookie` XSS attack. The token also contains a
non-guessable field `authenticity-id`.

To prevent leakage of the session-guard private key the cookie could
contain JWE document (instead of a JWT) encrypted by vapp-worker shared
private key/symmetric key.

### 1.4.3. The user-agent local storage contains limited session metadata

Localstorage contains the session user name, refresh/expiry time,
a refresh token and the authenticity-id but no other JWT access token
fields, explicitly not the JWT signature.

The authenticity-id is explicitly added by the client application to
all HTTP requests going to the vapp-worker. The worker then verifies
the authenticity-id to be equal to the corresponding field in the
implicitly sent access token cookie, or otherwise rejects the request.
This protects against CSFR attacks, which are unable to set the
authenticity field in the requests via redirection alone.

### 1.4.4. Security invariants

The solution possesses the OAuth2 qualities:
- Primary identity control, keys etc. never leave the identity service
- Client application doesn't get access to end-user login credentials
- Transient, minimal yet highly granular access grants for the client

The solution possesses additional qualities which are nevertheless
expected as the norm:
- Stateless ie. non-coordinated workers enable horizontal scaling

The two bleeding-edge qualities are logic and persistence separation
and trivial session lifecycle management.

#### 1.4.4.1. Agency-level separation between business logic and persistence

The solution sees application owner managing the vapp-worker component,
authority owner managing the authority component and identity owner
managing the vid-server.
The session-guard private key never leaves the application owner domain
so authority owner cannot use it to sign new events in the name of the
end-user.
Conversely, as the session-guard can be arbitrarily restrictive, and as
these restrictions are enforced by the authority, and as they are
further upheld by event-crypto-auditing infrastructure, the end result
is that the application owner cannot use the key to sign events in the
name of the end-user beyond the scope of the session partition itself.

These two qualities enable feasible agency separation.

TODO: write about the security impacts of collusion between separate
agencies, how event-crypto-auditing reduces the impact of collusion
between authority and application owners.

#### 1.4.4.2. Session lifecycle management

The session-guard can be specified to always require session partition
be part of all command transactions where session-guard is used to sign
commands targeting other partitions. If session partition is missing
the authority shall reject the command; if it doesn't this results in
an audition violation which the vid-server can detect.

The trivial way to terminate a session early is to freeze the session
partition (or destroy its root, which freezes the partition).
A simple way to revoke session access token(s) and inflict automatic
token refresh process is to change the session-guard associated with
the session partition. Either way, command transactions sent by the
client application will then be rejected by the authority.
This allows the vapp-worker to inform the user-agent to use its
possible refresh-token to refresh its access-token or if there is none
to request the user to re-login.

Terminations and revocations can be done without the involvement of the
client application directly through vid-server.
As an illustration the vid-server can trivially implement a
"revoke all sessions from all authorities" via valoscript three-liner:
```
identity.$V.getRelationTargets("PRIVATE")
  .map(p => p.$V.getRelations("SESSION")
    .map(s => s.$V.destroy()));
```


## 1.5. Sequence of auth-auth operations

### 1.5.1. end-user requests for an authorization code grant from vid-server

This is done currently using username/password but the vid-server can
in principle implement arbitrarily elaborate systems.

#### 1.5.1.2. The request contains the ValOS authority as the scope, with optional additional constraints
  response_type="code";
  client_id=[OAuth2 2.2.];
  redirect_uri=[OAuth2 3.1.2.];
  scope=<authority>;
  state=[OAuth2 10.12.];
```
  GET /authorize?response_type=code&client_id=s6BhdRkqt3&state=xyz
      &redirect_uri=https%3A%2F%2Fclient%2Eexample%2Ecom%2Fcb HTTP/1.1
      &scope=valaa-aws%3A%2F%2F...
  Host: server.example.com
```

### 1.5.2. vid-server handles the request and responds with a redirection URL to vapp-worker

vid-server also issues an authorization code for the client via
[oauth2 user-agent redirection](https://tools.ietf.org/html/rfc6749#section-4.1.2)

#### 1.5.2.1. vid-server creates a new session partition for the grant

This session partition is a ValOS partition owned by the resource
owner, hosted by the authority which also hosts the resources for which
the grant is requested. As such the session partition represents the
grant itself. In addition to all metadata of the grant request itself
it contains the signature verification certificates and tracking events
of all relevant grant activity. It can be used to revoke the grant
prematurely.

#### 1.5.2.1.1. vid-server obtains the private partition associated with the end-user in the resource authority

This can already exist, in which case the existing private partition is
used.

If no existing private partition is found then the vid-server,
the authority and the end-user negotiate and create a new private
partition for the end-user within the authority.

This process might involve substantial delays and is outside the scope
of this doc.

The vid-server then registers the current end-user signing
certificate into the private partition.

#### 1.5.2.1.2. vid-server creates the session-partition

This is done via CREATED command for a new session Relation (or
possibly a new fabric type), with:
- the name of the session Relation is `SESSION`
- the source of the session Relation is set to the structured
  sub-resource `sessions` of the private partition
- the target of the session Relation is set to the client application
  identity partition
- the authorityPartitionURI is set to the requested authority, making
  the session Resource into a sub-partition

The vid-server generates the `session-guard` Ed25519 key-pair and puts
its public key into (which?) session property/field.

#### 1.5.2.1.3. The id of the session Relation is used as the basis for the authorization code

This id is implicitly created by crypto-resource-id algo
[CRYPTO-RESOURCE-ID.md] and is derived from the private partition event
log hash-chain, its owner cert and a secret salt.

This id can be optimistically delivered in the grant response even
before the authority confirms or rejects the session partition creation
transaction.

If the authority subsequently rejects the session partition creation
then the only result is that the authorization code itself will be
rejected.

#### 1.5.2.2. vid-server constructs the authorization grant redirection response

The session partition id is placed in the authorization code.
The session-guard private key is placed in the authorization code.
An authenticity-id is created (for CSFR prevention) and placed in the
authorization code.

The authorization code is encrypted using the public key of the client
application and placed into the [redirection URI query parameter `code`](https://tools.ietf.org/html/rfc6749#section-4.1.2)

In addition, the authenticity-id and the end-user visible name are
appended in the redirection URI fragment part.

### 1.5.3. user-agent is redirected to the vapp-worker

The authorization grant response redirects the user-agent to the
vapp-worker application client site.

### 1.5.4. vapp-worker processes the authorization code and responds with an access token cookie

The vapp-worker acts as the [access token end-point](https://tools.ietf.org/html/rfc6749#section-3.2)
and extracts the authorization code from the query parameter `code`,
validates it and creates an access token which:
- Is JWS? JWE? plain JSON, after all it gets encrypted anyway
- TODO(describe fields)

#### 1.5.3.1 vapp-worker chronicles an initial session partition client command

The chronicled command contains the unencrypted access token (somehow),
is targeted to the session partition with log.index equal to 1
(log.index 0 event is chronicled by the vid-server) and is signed using
the session-guard private key.

- If this fails because no log.index 0 exists, retry; but if the
  retries ultimate fail the session creation is considered to have
  failed (see 1.5.2.1.3.).
  TODO: evaluate DDoS suspectibility of allowing retries.
  unauthenticated requests which leave resources pending (such as
  waiting for retry here) are potential DDoS attack vectors.
- If this fails because log.index equal to 1 already exists, then this
  is an attempt to reuse the authorization grant and
  [must be rejected](https://tools.ietf.org/html/rfc6749#section-4.1.2),
  also possibly (yes or no? when yes?) also invalidating all access
  codes from the session partition.
- If this fails because of a forbidden session-guard signature then
  this is either erroneous or malicious request and should be elevated.

#### 1.5.3.2. a successful chronicle allows access token to be returned as a cookie

The access token is encrypted, base64url encoded and set as a cookie in
the response:
```
Set-Cookie: client_login=<encrypted-access-token>; Secure; HttpOnly
```
Note: This is a divergence from [OAuth2 access token response](https://tools.ietf.org/html/rfc6749#section-4.1.2)
which combines the access token response with the site page load
itself. Thus prevents the client site scripts from accessing the token,
aiding against XSS.
