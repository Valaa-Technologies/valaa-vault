# Valaa Open System Security and Attack Model primer

This document is a rough conceptual dump of ValOS infrastructure
security considerations as of 2019-03. Reader is expected to have
passing familiarity with event sourcing. Otherwise the document
purports to be a high-level stand-alone document and begins with an
introduction to central ValOS concepts and specifically how they relate
to the general world wide web architecture.

Author's disclaimer: this document is written by a single person and
I'm not a security professional. I genuinely believe in that the core
concepts and the overall approach is sound. Non-trivial amounts of both
real and calendar time, thought and experimentation has gone into the
ValOS infrastructure taking shape. But even if you read and keep
agreeing don't let that fool you: there can be gaping maws of black
holes of omission that I just didn't happen to think of. Security audit
is pending resources.

# 1. Correspondence between webarch ( https://www.w3.org/TR/webarch/ ) and ValOS infrastructure concepts

In general ValOS strives to use webarch designs, concepts, and
terminology directly as far as possible. However, there are fundamental
differences which require a different name for
different-yet-corresponding concepts. There are four such major cases:

Correspondence name | webarch concept | ValOS concept    | ValOS description
--------------------|-----------------|------------------|------------
Document            | Web Document    | Partition        | Event log container with a fixed URI
Presentation        | Web Browser     | Inspire Gateway  | JavaScript component in browser
Logic               | Web Server      | Perspire Gateway | JavaScript component on Node.js
Data                | Database        | Authority        | Event authorizer and broker

Side note: the two gateways share vast majority of their structure (read:
they use the exact same codebase).

The three fundamental differences that cause these divergences are
elaborated in more detail:

## 1.1. Three Tier architecture - ValOS flips Logic/Server and Data/Database tiers:

When compared to the traditional three-tier model:

`Presentation/Browser <-> Logic/Server <-> Data/Database`

ValOS flips the order of Logic and Data tiers:

`Presentation/Inspire <-> Data/Authority <-> Logic/Perspire`

In ValOS architecture both `Presentation/Inspire` and `Logic/Perspire`
gateways talk to the Data/Authorities.

## 1.2. Same ValOS Gateway implementation runs both ValOS `Presentation/Inspire` and `Logic/Perspire` layers

There is very little technical difference between `Presentation/Inspire`
(in browser) and `Logic/Perspire` (JavaScript in Node.js) Gateways.
They subscribe to partitions similarily, send new commands to
partitions similarily and perform computations with the same
infrastructure codebase.

If the application and synchronization logic allows the same ValOS
Logic components can be executed directly on the `Presentation/Inspire`
tier Gateway even if the 'conceptual home' would be a `Logic/Perspire`
Gateway. Implementing this has obvious limitations: but whenever
possible this offers substantial benefits in lower costs, low latency
and simpler architectures resulting to faster development cycles.

Only when the responsibilities, execution context needs, security
considerations, synchronization problems and/or external integration
needs so dictate is a separate `Logic/Perspire` tier is needed.

## 1.3. webarch Content is fundamentally static - ValOS Content is fundamentally dynamic

HTML/JSON/etc. web documents over HTTP are fundamentally static
representations. Streaming API's, AJAX etc. do solve most practical
needs for dynamic content updates but are still conceptually a bit of
a hack. The content itself and the updates to that content are
described using different paradigms: content is typically an object
representation of some kind ands update are imperative functions which
manipulate the object representation.

In ValOS the state and its changes is purely represented using ValOS
partition event streams only. These dynamic change events are used
(`reduced`) by the gateways to build all types of application state,
_both *logic* and *dynamic* state_ from ground up each time. This does
not mean that ValOS would eliminate code or files altogether;
traditional source code is used to perform computation and generate new
events in response to user (and other) actions. Traditional UI
presentation files are used to describe how the UI is presented based
on the internal state.

Nevertheless this presentation/logic is the most superficial layer only
and everything below it is converted to and from events.

# 2. Terminology

## 2.1. Event sourcing - Capture all changes to an application state as a sequence of events.

This darling child has many names: event logs, change history,
the-things-that-get-hash-chained, etc.
Redux reduces its events and never called it event sourcing.

ValOS draws its terminology from Martin Fowler's popularization from
the year 2005 ( https://martinfowler.com/eaaDev/EventSourcing.html ).

It should be noted that as a fundamental divergence to traditional
event sourcing 'done right' and to domain driven design specifically
ValOS event sourcing is a straightforward CRUD event sourcing with
a limited set of generic event types manipulating a general purpose
resource model.

## 2.2. Partition - A globally unique URI which identifies and locates a single event log

The partition URI can be resolved by the gateway to retrieve the event
log as well as to subscribe for new events. The gateway then reduces
the event log to an internal resource representation. If this
representation is an application it can then be shown to the user. If
it is a data set it probably was requested by an already running
application for some particular use, usually then indirectly shown to
user anyway. Nevertheless as all partitions can receive new events
dynamically, this makes logic and data partitions inherently correspond
to streaming, interactive web documents.

Because a Partition URI is stable and tightly associated with its
partition it allows events in different logs to refer to each other.
This is what allows the global, shared ValOS resource space to be
segmented into manageable sized pieces without splintering it to
isolated boxes.

An typical early stage web application uses anywhere from four to
several  dozen partitions which cross-reference each other to render
the final product to user.

## 2.3. Authority - A Data layer server which hosts, authorizes and distributes the events of multiple partitions

An authority is where gateways connect for event stream(s) of
partitions owned by that authority.

While this would make the most tempting analogy to be the "web server"
the best correspondence for an authority is the backend database.

Both try to be as dumb and resilient as they can get away with, don't
perform computation, offer their services via generic, stable API and
provide persistence services.


# 3. Attack model against ValOS infrastructure

The ValOS security model into two major domains based on whether the
attack is made directly against infrastructure promises
(`infrastructure integrity security domain`) or whether the attack
happens indirectly via trying co-opting user computation and/or
identity (`hapless user protection security domain`).

The third security domain is the authority security domain. This domain
is intentionally void as on one hand authorities are not automatically
trusted and on the other hand authorities are expected to secure their
own systems (`wild west authority security domain`).

The dynamics of the first two domains differ considerably. As of
2019-03 this document primarily focuses on the infrastructure integrity
domain as 1) without it the hapless user protection domain is largely
meaningless, 2) there are use cases which don't have any users to
protected or there is no computation that could be attacked, and 3) at
early stages of the ecosystem there are practical solutions to mitigate
hapless user protection issues even without strong protections.

## 3.1. Infrastructure integrity security domain

This domain considers attacks that try to break the promises of the
infrastructure itself.

The central promise category (as of 2019-03, the only category) are the
various *partition behaviors*.  A partition behaviour is a named (like
`isLocallyPersisted`, `restrictedEventSignatures` or `forgetful`) and
well-specified behaviour of the partition or its event a particular
partition _can have_. The semantics of a partition is fully defined
as the combination of all partition behaviors it has.

Attack models against partition behaviors are specific to the semantics
of each behavior.

## 3.1.1. Partition behaviors are advertized by authorities, requested by partition creators

Partition behaviors are customizable parameters which are initially set
when the partition is within an authority. Well-behaving authorities
don't need to support all behaviors and some behaviors can come
hard-coded if the authority is some speciality authority.

The attack model analysis of each behavior yields a security profile
of what assumptions must be broken for the overall behavior to break.

### 3.1.2. Behaviour trust grouping from gateway user perspective

Looking at the security profiles from the perspective of a gateway user
these behaviors are grouped into three *rough* trust categories in
increasing levels of trust required: capability, cryptographic and
social behaviors.

This grouping is not definitive but only informative as different
behaviors are still associated with different types of attack models
and unique security profiles.

### 3.1.2.1. Capability behaviors relate to semantics, performance or are informative

A capability is a behavior that a client can enforce themselves or is
otherwise trivially true.

These are usually trivial attributes of the partition:
- `isLocallyCached`: if the partition content is to be persisted
  locally so that it survives browser/server refresh.
- `isRemotePartition`: if false, the partition is local to the gateway
  (can be combined with isLocallyCached)
- procedural partitions where the event content can be derived from
  the partition URI itself via a publicly known algorithm.

### 3.1.2.2. Cryptographic behaviors

A cryptographic behavior is one which relies on clients to be able to
audit the event log when receiving events. This auditing is done using
ValOS crypto algorithms like hash-chaining, event-signing and
deterministic resource id generation (etc.) to prove that the partition
satisfies the specified behavior up to the audited event index.

For example, ValOS infra might allow an application developer to create
a partition with promise:

- `allowOnlyEventsSignedBy`: only signed events by these keys/certs are
  accepted as truths
- `immutableHistory`: historical events cannot be altered without it
  being apparent to gateways,
- `limitedEventTypes`: only allow a particular subset of Event types,
- `limitedResourceModifications`: only allow modifications on
  particular sets of resources,
- `mutableBehaviors`: allow modification of the partition promises by
  specific events,
- `deterministicResourceIds`: only allow resource ids which are
  deterministically tied to the event log itself (this is a central
  promise, but explaining this open is a post of its own).

It is the job of ValOS infrastructure to not just enable backend
implementations but to cryptographically require them to make good on
these behaviors promise lest clients outright rejecting the event log.
And do this in a way that is still technically reasonable.

### 3.1.2.3. Social behaviors

Social behavior is one where client needs to trust the authority
and/or other users without an ability to prove

- `isPrimaryPartition`: whether the partition contains primary content
  which can be modified or whether the partition is (living or static)
  shadow of some external source.
- `forgetful`: no one, including partition creator, will be able to
  retrieve historical event data, only the most recent,
- `crossPartitionTransactions`: events in this partition can be part of
  a (atomic) transaction spanning multiple partitions.
- etc.

## 3.1.3. Behavior interactions

Even separately each one of the promises have different security/trust
profiles. For example `forgetful` is a promise that cannot be
cryptographically validated. Thus there's no way of knowing if some
authority, service or client retains copies of the history. This is a
promise where the partition creator has to have social trust the
authority which hosting the partition - or institutional trust, where
things like GDPR and legislation comes into play.

On the other hand `immutableHistory`, `limitedEventTypes` and
`limitedResourceModifications` are promises where hash-chaining even
without signing can be used to reduce the social trust the partition
creator needs to have on other actors, especially authorities. But even
this is possible only if there is a jointly trusted third party which
maintains a list of "truth signatures". Maybe this third party is some
global block-chain which contains "most recent validated and authorized
truth hashes of all the world's partitions".

If there is no third party and no event signing then these behaviors
become social behaviors: the gateway must again solely trust the
authority.

Finally, when taken together and looking at a particular set of
behaviors requested of a partition the combinations will get even more
complex. Some promise combinations are outright not possible.
For example the promise `forgetful` is potentially fundamentally
incompatible with `mutablePromises`, because there's no way to validate
the history to see if the promises have changed.

## 3.2. Hapless user protection security domain

This domain considers attacks that try to co-opt the computational
resources and/or identity of a `hapless but reasonable user` in order
to bring into being 1) infrastructurally valid ValOS events that are
signed by the hapless user or 2) other computational side effects, yet
3) which are against reasonable expectations of the hapless user.

As a general purpose, decentralized interactive content creation
platform ValOS cannot be expected to be able protect against all
attacks in this category. However, all tools and solutions that are in
line with ValOS philosophy and which help in reducing the prevalence
and impact of this category of attacks should be aggressively pursued
and integrated into ValOS core.

Once a technical solution is accepted as part of ValOS core
infrastructure it becomes part of the infrastructure integrity domain.

### 3.2.1. Gateway guarantees

Gateway guarantees are mechanisms similar to CORS protections.

The role of a gateway in ValOS ecosystem is similar to browsers. It is
a 'standardized', audited executable. Its users rely on it to restrict
and isolate computation and requests made by the partitions (ie.
documents) it handles and presents to the users in various ways. It
does this to prevent malicious or broken partition from behaving
against the interests or expectations of the user.

Gateway guarantees revolve around partition content interpretation,
computation and presentation by restricting these processes based on
the origin and other relevant contextual information.

As of 2019-03 There are no gateway guarantees, as they're mostly
pending the authentication infrastructure.

## 3.3. Wild west authority security domain

The third major component of the ValOS infrastructure, Authorities, is
of lesser importance due to couple of reasons.

From the perspective of authority owners:
- authority owners can typically be expected to be in full control of
  their own infrastructure
- authority owners are free to can use existing ValOS authority code
  bases or write their own against their chosen ValOS protocol
  specification
- functional requirements for handling event streams don't necessitate
  arbitrary computation (this is done in `Logic/Perspire` Gateways),
  thus implementing code which reaches the security criteria of the
  authority owners is easier

In other words authority owners can take care of themselves if they
want to, and if they don't want to there's nothing that can be done
about that besides client-side crypto validation schemas.

From the perspective of clients:
- technical and cryptographic trust aspects of partitions are provided
  by `Presentation/Inspire` Gateway performing validation of all
  incoming content, including crypto validations. Authorities are
  assumed to be broken and to only work usefully by accident.
- social trust aspects towards authorities are provided by the
  incentives of the company/party/algorithm which hosts/pays/implements
  said authority. Or broken, or obviously lied about, depending on the
  nature of the social promise.

### 3.3.1. Institutional actors, Authorities and `Logic/Perspire` Gateways

For an institution with specific business case the authorities are
likely only part of their own ValOS infrastructure. If they want to
perform protected computation, host query-response business logic,
expose API's etc. as they're very likely to want to do they will launch
Perspire Gateway workers.

These workers however run the same gateway as Inspire Gateway in the
browser does the same technical guarantees that made to Inspire Gateway
users apply to them also. In addition, the initial configuration of
a `Logic/Perspire` Gateway can be made as restrictive as desired,
allowing execution of only a select set of partitions and communication
with only the authorities of the institution itself.

# 4. Who is the attacker?

Note: this section is of noticeably lesser quality than the earlier
sections and truly just a draft starting point.

Everyone is a potential attacker from the general ValOS standpoint.
The vertical scope of ValOS infrastructure is the OSI
application/presentation layer as that's where events and their
resource contents are handled. For some behaviors the session layer is
relevant: there is value in an authoritiy being able to tie a gateway
user login identity to a particular connection _separately_ from the
key that the gateway uses to sign events.

Horizontal scope is everyone involved at all stages of the event stream
handling, including all gateway streaming nodes and the backend
authorities.

# 4.1. What is the aim of the attacker?

For partition behaviors the attack target is the specific behaviors
that ValOS infrastructure allows that particular partition to make.
For this the aim of the attacker can be any of the following generic
goals:
1. getting answers to specific "yes/no" questions regarding streamed
   information
2. extraction of arbitrary information content from an event stream
3. disruption of event streams with corrupted events so that they get
   blocked
4. forgery of new events (incl. impersonation) so that they pass crypto
   auditing
5. alteration of existing event history

For gateway guarantees the attack target is 'privilege escalation', so
that malicious partition content can break the restriction guarantees
that were requested from the gateway by the root application partition
and/or by the gateway user. Browsers implement this by deny-all,
allow-by-CORS, we will have to either co-opt CORS or come up with our
own.

# 4.2. What are the capabilities of the attacker?

This section not even started.

NOTE(iridian, 2019-02): Two hilariously general hand-wavy principles
or a wishlist that I dumped here to use as a conceptualization starting
point:
- no-cascade principle: when a set of assumptions are broken in a way
  that leads to break-down of a partition behavior or a gateway
  guarantee this shall only result in a sub-sequent breakdown of lesser
  amount other assumptions. What is lesser should be well-defined as
  some type of total ordering between over all behaviours/guarantees
  and their assumptions.
- baseline-read-failure-to-no-writes: when an attacker manages to
  breach for an unencrypted read access to either a
  not-specifically-protected part of the event stream content handling,
  to in-memory execution contexts or to persisted content this breach
  must not result in the attacker being able to use information to make
  new events with impersonated identity or elevated privileges against
  baseline-secured partitions.

  "specifically-protected" is a provision for storage that contains
  identity information, security tokens etc. It could f.ex. be a
  solution where event signing is done in a process space separate to
  the JavaScript execution context (service workers, using crypto API,
  etc).
  Alternatively an authority can maintain identity sessions and only
  accepts events which are coming across that particular session _and_
  are signed by an identity affiliated with that session, in a solution
  where session login key/password are not stored or are stored
  separately from the event signing key.
