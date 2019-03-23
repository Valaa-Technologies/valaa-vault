# A draft of a distributed event log system, with collision-free resource id's, multi-authority operations in general and cross-authority resource moves in specific, tracking of change authorship and managing resource permissions in a decentralized, partially hostile multi-actor ecosystem.

This document is a text-based mind-extension of a conceptualization
process that took place in 2018-11. The result of this process is the
valos-resource-crypto-id algorithm draft described in section 4.2.

As of 2019-03 this document primarily acts as a place-holder for a
better structured document but with one additional purpose. This is to
demonstrate for a specific viewer(s) (you know who you are) not just
the details of the algorithm itself, but the work, the constaints, the
assumptions, the desired functionalities and in general the scope of
the detail behind and around the valos-resource-crypto-id algorithm.

I hope you never see this message, and that I have been able to write a
better structured document in this place. But the work for that is
non-negligible, so it might take a moment.

## 1. Acute need is to figure out whether it is >90% likely that a nice commandId-creation-algorithm (section 4.) can be devised which satisfies the needs listed in this doc
### 1.1. this also includes determining whether the needs and assumptions are overall sane and internally consistent
## 1.2. If not, secondary goal is to come up with alternative solutions which don't require a big design overhaul; as a combination of altering the design and dropping some assumptions/goals.
## 1.3. most salient, conservative but most constraining fallback is having resource id's contain the id of the originating authority/user, described in section 7.
### 1.3.1. this practically amounts to "no moving of Valaa Resources between authorities; manage your semantic resource moves via ownership tokens or some other shit in valaa-space". Do not want.

# 2. Current design of the relationship between resource id's and the commandId's of the events which create them

## 2.1. A command has a commandId which is a globally unique identifier (uuid v4 atm, but see section 4)
### 2.1.1. Resource(s) created by a command have their id(s) derived from the commandId
### 2.1.2. command has a content-hash of the command payload (including the commandId)

## 2.2. A command becomes part of an event log and becomes an event when authorized to it by an authority. An event has all primary content of the originating command but additionally it gets
### 2.2.1. an auto-incrementing eventId, giving the events in the log a strict linear ordering
### 2.2.2. monotonically non-decreasing timestamp (best-effort UTC as epoch ms, precise for 1970 + 28542 years? authority specific?)
### 2.2.3. other essential fields that form an essential part of the event history
### 2.2.4. other metadata fields that are informative but don't form part of the event history
### 2.2.3. a hash-chain-hash based on its content-hash, the hash of the previous event, the timestamp, and any essential fields

## 2.3. A client dispatching a command knows the contents of the event log it is targeted, and provides the expected eventId (but not timestamp and thus not hash value either)
### 2.3.1. client can give authority(s) a permit for reordering an event which would allow the hash to change
### 2.3.2. reordering permit can include preconditions/constraints which define when the command should not be allowed to be reordered
### 2.3.3. reordering permit can include finalizer computation which adjusts the command after reordering
### 2.3.4. in extreme cases reordering can be fully opportunistic, relieving the client of the need to know the precise contents of the event log

## 2.4. A command which affects multiple backend authorities and thus separate event logs is a multi-authority command
### 2.4.1. note: a single authority can in principle host multiple event logs (ie. 'partitions'). But for simplicity this abstraction is dropped; for the scope of this doc partitions can simply be seen as separate authorities.
### 2.4.2. a multi-authority command is split between the separate authorities in a well-defined manner
### 2.4.3. all split commands share the same commandId
### 2.4.4. the authorities accept or reject the command as an all-or-nothing consensus
### 2.4.5. when authorized each event uses the same commandId and gets a listing of all other authorities as an essential field (2.2.3.)
### 2.4.6. a multi-authority command between a particular set of authorities is supported if and only if all the authorities share a well-defined multi-authority-command protocol which they have advertised to the client

# 3. Assumptions - no one trusts no one

## 3.1. about actors, their incentives and the source they run
### 3.1.1. majority of the users run a 'conforming' gateway: either an unmodified client gateway (ValOS inspire) which open source and is developed by gated community, or one which conforms with it
### 3.1.2. minority of the users are fully collaborative malicious bastards who have the resources and the intent to cause instability in the ecosystem for whatever reason
#### 3.1.2.1. in principle the ecosystem should survive even though on the whole majority of the users would be selfish and run modified client gateways as long as no selfish/malicious group collaborates with each other. However, this scenario can (maybe?) for the most purposes be simplified to "minority are fully collaborative full bastards".
### 3.1.3. majority of the authorities will run a custom authority with whatever modifications they can get away with that maximizes their profits/other incentives

## 3.2. about clients
### 3.2.1. clients are untrustworthy as they can be malicious, get corrupted, hacked or infected
### 3.2.2. clients can crash whenever, otherwise lose sessions and forget state fully or partially
### 3.2.3. clients can go offline without crashing, keep creating new commands into an outgoing queue and expect to survive coming back online and have their commands be authorized into events under reasonable assumptions.

## 3.3. about trust relationships
### 3.3.1. authorities can have a mechanism to associate an incoming command with an authenticated identity, which they use as a basis for permissions checking and event authorization
### 3.3.2. authorities can form trusted communication channels (via TLS etc) to establish session based trust

## 3.4. about event integrity
### 3.4.1. all clients can deal with semantically broken event log content without stopping playback by discarding broken events
#### 3.4.1.1. semantic breaks include broken references, modifications to non-existent/no-longer-owned resources etc.
#### 3.4.1.2. thus authorities don't need to care about the semantic content of the commands (although they can, if they want to provide extra guarantees).
### 3.4.2. conforming clients verify and halt/abort structurally broken event log playback
#### 3.4.2.1. structural breaks include multi-authority events with missing counterparts, collisioning resource ids from multiple event logs, unrecognized event JSON fields, etc.
#### 3.4.2.2. when multi-authority event log playback break is combined with 3.3.1., clients can trust authorities with their advertised multi-authority command protocol capabilities to work most of the time, as faults are detected anyway and buggy/cheating authority reputation is lost
##### 3.4.2.2.1 additional trust can be created by tighter multi-authority-command protocols (see section 6.)

## 3.5. other assumptions

# 4. commandId-creation-algorithm is used by the client to create a commandId for an out-going command

## 4.1. functionality

### 4.1.1. commandIds should be effectively collision resistant against malicious clients when dealing with mostly friendly/conforming collaborators.
### 4.1.2. an authority should be able to detect and reject an incoming event with a commandId which doesn't obey the algorithm described here
#### 4.1.2.1. with 3.4.2.2. this simplifies client side multi-authority event handling logic: clients can trust that an incoming event with a commandId that matches its own pending multi-authority command is not an event created by another malicious client
#### 4.1.2.2. client might crash, lose the session, but might still want to verify whether the multi-authority event was successful based on the event log alone)
### 4.1.3. authorities must not need to be aware of each other prior to receiving a multi-authority command as long as they have advertised support for a protocol. This is to allow the creation of commandId fully on the client side, possibly even before knowing the final authorities

## 4.2. proposal: cert-salt-hash-commandId's

### 4.2.1. brief: client-created certificates are used as a basis for creating commandId's

### 4.2.2. technical details
#### 4.2.2.1. a client registers a certificate into some authority event log, along with a proof of owning the private key
##### 4.2.2.1.1. this cert can be non-signed, transient, one-off even
##### 4.2.2.1.2. the authority assigns the cert an id that is local to the event log
##### 4.2.2.1.3. authority always maintains a set of all certs that have been used for the event log, with their most recently used salts and their revokation status
#### 4.2.2.2. for each new command the client creates a commandId by hashing the catenation of the certificate text and a salt number as text
##### 4.2.2.2.1. the salt number must be monotonically incrementing (not sequential) index
#### 4.2.2.3. the resource ids created by the command are a derivation/hash of the commandId, authority id and a auto-incrementing index (internal to the event)
#### 4.2.2.4. client sends the command to the authority along with the salt, and a signature of the command content hash using this cert
##### 4.2.2.4.1. authority uses session (3.3.2.) to identify and verify the ownership of the certificate associated with the client
##### 4.2.2.4.2. if there was no session but the client still wishes to use the cert for which it has the private key, the client can send the cert identifier (or even the full cert text itself) with a signature of the command content-hash created using the cert
#### 4.2.2.5. if authority authorizes the command, then it records the cert id and the salt into the event as essential fields (2.2.3.)
##### 4.2.2.5.1. this allows all event log consumers to attest that the commandId was derived from a cert that appears in the event log

### 4.2.3. analysis (contains entries which should also be in the functionality wishlist)
#### 4.2.3.1. commandId conflicts are prevented unless the cert private key is leaked
#### 4.2.3.2. a malicious client could 'poison' the ecosystem with duplicate commandId's which don't correspond to the same multi-authority command. This would not amount to much, however, because
#### 4.2.3.3. no duplicate resource id's can still be created in conforming event logs as the resource id's use the authority id as a hashing source (4.2.2.3.), and the same commandId can't reappear in the same event log more than once because salts cant be reused (4.2.2.1.3. with 4.2.2.2.1.)
#### 4.2.3.4. as each event is affiliated with a cert, this can be used to track and modification ownership throughout history
##### 4.2.3.4.1. clients who wish to demonstrate authorship of modifications selectively post-fact can retain their cert private keys to sign challenges
##### 4.2.3.4.2. clients who wish to openly declare authorship can register the cert to services which track authorship
###### 4.2.3.4.2.1. this allows the cert to be revoked and its private keys permanently discarded
#### 4.2.3.5. the event log conformance can be determined by inspecting only the essential event log data
#### 4.2.3.6. the conformant event log truthiness can be confirmed or rejected by using the hash-chain-hash of the latest event in the log, as hash-chains do
#### 4.2.3.7. registering the cert can be a CREATED event for a resource of type "Certificate" with its $V.id as an URI using 'valos-cert:' immutable schema which is a 1-1 mapping of the cert text
##### 4.2.3.7.1. this can then result in the creation of a Certificate type resource visible in valaa-space, which could be used as an explicit target of PERMISSIONS relations and be an implicit target of some mutable 'Resource.author' field for all resources that were created using it
##### 4.2.3.7.2. this would allow a finer tuning of access rights of particular resources, via the creation of several Certificate objects into an authority and assigning different resource authors to different certs

# 5. Moving resources between authorities:

## 5.1. a resource can be moved between authorities via a multi-authority command which contains ownership change of the resource to an resource in the target authority
### 5.1.1. be mindful that there are _three_ different dimensions in play: primitive vs. TRANSACTED commands, single- vs. multi-authority commands, and commands with resource ownership changes vs. other changes like plain value updates. 7 out of 2^3 = 8 possible combinations are valid. The only combination that doesn't currently exist is due to primitive commands which don't contain ownership changes: these are always single-authority, never multi-authority commands.

## 5.2. the receiving authority should be able to verify that the originating authority actually has authority for releasing the resource, ie. that the originator event log:
### 5.2.1. obeys commandId-creation-algorithm
### 5.2.2. contains the event in which it obtained the resource and that this event is valid, ie. either it:
#### 5.2.2.1. is a valid CREATED event for the resource, which obeys commandId-creation-algorithm which algorithmically guarantees it to be the creation of a new unique resource
#### 5.2.2.2. is an event where the resource was ownership was transferred, in which case Some Ownership Tracking protocol is followed (possibly back to the original creator authority) to establish the validity of the ownership claim
### 5.2.3. hasn't relieved the ownerhip or destroyed the resource in the intervening events

# 6. Hypothetical multi-authority-command protocols:

## 6.1. 3rd party event-log-hash-signer service
### 6.1.1. this is an authority in itself, but this is also a service where other authorities can register and bind their own event logs
### 6.1.2. when an authority binds its event log to a hash-signer, this commitment appears in the event log of the authority itself
### 6.1.3. a multi-authority transaction on authorities which have committed to a shared hash-signer can include the hash-signer in the transaction
### 6.1.4. the hash-signer will emit an event as part of the transaction
### 6.1.5. clients now do not need to subscribe to both authorities to determine the validity of a purported multi-authority command which appears in one of the event logs, but can rely on the hash-signer event log (which is likely much more global and performant)

## 6.2. like above but with a single global multi-authority-command-tracking-blockchain-or-something

# 7. Major alternative: Resource id internally contains the id of the originating authority/actor

## 7.1. on one hand this would be a more familiar, convervative solution and would solve most of the practical problems described here, but:

## 7.2. moving resources between authorities might be more difficult, if not impossible
### 7.2.1. core problem is updating foreign references to the moved resources
#### 7.2.1.1. this means authorities which are not actively tracking the source and target authority of a moved resource, but which nevertheless hold a reference)
#### 7.2.1.2. some foreign references are fundamentally prevented from tracking: an authority/event log might become permanently frozen but still keep the pre-move reference
### 7.2.2. this is a non-trivial problem which should have as much infrastructure/ecosystem support as possible, instead of placing the responsibility for valaa-space developers
#### 7.2.2.1. OTOH: even infrastructural solutions are not 'clean' either: essentially some kind of forwarding tables that originating authorities maintain, or third party services which provide resource move tracking - so maybe in the end moving resources is something that should be solved inside valaa-space?

## 7.3. boundaries between authorities would be both more pronounced and rigid on valaa-space
### 7.3.1. this would require a mind-share of developers even when not needed, especially for new developers.
### 7.3.2. ie. if you have authenticated full write authority over two authorities, even a complex recursive composite resource move should be a trivial "thingToMove.$V.owner = newOwnerInOtherAuthority;"

## 7.4. on short-term this would require rewrite of considerable parts of the current implementation

## 7.5. conclusion: do not want this alternative solution