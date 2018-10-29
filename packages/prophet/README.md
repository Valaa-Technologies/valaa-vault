# @valos/prophet provides ValOS-RAEM stream components

This package is likely the most important package of Valaa Open System.
@valos/prophet specifications and components provide the foundation for
event stream and bvob content delivery network. All the rest of the
Valaa infrastructure and by extension of the whole ecosystem build on
top of this fabric.

The dense definition of Valaa ecosystem is:
  1. All content is stored inside *Valaa Resources*, which act as
     nodes inside
  2. a unified, global, immense *ValaaSpace* network, which is
     segmented into
  3. smaller, non-divisible but fully cross-connected groups of
     Resources called *Partition*s, each of which is owned by
  4. *Authorities*, which also govern, host and serve those partitions
     to downstream users via
  5. a distributed network of high-level *Prophet* nodes, which provide
     the concrete
  6. *PartitionConnection* access points which enable users to access
    the upstream partitions.

With these concepts this specification aims to implement the
distributed event sourcing paradigm between many independent downstream
consumers and many independent upstream authorities comprehensively,
scalably and robustly.

This package also extends the @valos/script schema with Media and
Entity. Media is a file-like content container. Via Prophets and
PartitionConnections it allows reading, writing and interpreting
the content. Entity in turn provides directory-like hierarchies for
Medias and other Entitys.

This package also extends command/truth event semantics defined in
@valos/raem with the concepts of restricted and universal commands.

This package also provides various Prophet component javascript
implementations which can be used to implement the full valaa
application stream gateway inside a client browser. Some of
the components generalize to non-browser contexts, some are fully
browser specific.

- depends: `@valos/script`, `IndexedDB`, `AWS IoT/S3/DynamoDB`
- exports: `FalseProphet`, `PartitionConnection`, `ProphetContentAPI`
- ValaaSpace: `Relatable`, `Entity`, `Media`, `Relation`,
- concepts: `ACID`, `authorities`, `pub-sub`, `offline readiness`


## 1. Deconstruction of the dense definition

### 1.1. *Valaa Resource*s are the basic building blocks and defined by package schemas

### 1.2. *ValaaSpace* contains everything

### 1.3. *Partition*s allow loading resources and requesting updates selectively

Event sourcing, for all its expressive power and architectural
simplicity, has a major glaring weakness: loading a single resource
means loading all other resources in the event log. This is fine in
limited contexts like singular projects of a desktop application. But
ValaaSpace as a unified, global repository is immense. In order to not
be useless it cannot be a trivial singular event log.

The Valaa solves this problem with *Partition*s which divide
the ValaaSpace into smaller pieces.


#### 1.3.1. Partition rules

##### 1.3.1.1. A Partition contains a single root Entity

This entity is called *the partition root*.


##### 1.3.1.2. All resources owned (even indirectly) by the partition root belong to the partition

Together with the partition root these are called
*the partition resources*.


##### 1.3.1.3. Each partition has an event log which contains all the events that modify the partition resources and no other events

Those events have an incrementing serial number *eventId*. Together
they form *the partition event log*.


#### 1.3.2. Low coupling and high cohesion rules even more

##### 1.3.2.1. Low coupling saves network bandwidth and CPU ...

When [partitions have low coupling in relation to each other](https://en.wikipedia.org/wiki/Coupling_(computer_programming))
(ie. dependencies between partitions are clear and mostly
one-directional) then bandwidth and computational resources can be
saved. Partitions which contain information that is auxiliary to
the application don't need to be loaded before needed. For example
a game might have separate areas be in separate partitions and only
start loading the next area when the player is about to finish
the previous one.


##### 1.3.2.2. ... and high cohesion saves time, spares nerves and minimizes overheads

Loading a partition still loads all of its resources. With a sound
partition design this is advantageous. As a corollary to the low
coupling above, when [resources inside a partition have high cohesion](https://en.wikipedia.org/wiki/Cohesion_(computer_science))
(ie. loading one resource means that it is very likely to load the
others) it is useful to load them all together as it spares the network
latency and overheads of repeated consequtive requests.


### 1.4. *Authority*s implement the infrastructure and authorize new events for their partitions

### 1.5. *Prophet*s are software components which connect to each other and form information streams

### 1.6. *PartitionConnection* provides an API for accessing an individual partition

Receiving and sending information to a partition is done using
a *PartitionConnection*. With the the Prophet that provided
the connection it manages four types of information streams:
  1. commands sent towards upstream
  2. truths received towards downstream
  3. media content uploaded to upstream
  4. media content downloaded from upstream


## 2. *Media*s and *Entity*s as files and folders

### 2.3. Media interpretation process

Media interpretation is the process of retrieving content and
converting it to a representation that is useful for users. It is split
into three stages: *retrieve* octet stream, *decode* as object
representation and *integrate* in use site context.


#### 2.3.1. Bvob *retrieve* yields an ArrayBuffer via network download, cache hit, etc.

Persisted octet sequences are typically identified by their *bvobId*,
a well-defined content hash of the whole octet sequence (and nothing
else). Their in-memory representation is shared between all consumers
inside the same execution environment.


#### 2.3.2. Content ArrayBuffer is *decoded* into immutable, cacheable object representation based on mime

The octet stream is decoded by decoder plugins associated with
the requested mime type into some runtime object representation. This
object representation can range anything from a flat text decoding,
through a complex javascript composite object representation into a
full-blown component with rich, asynchronous API's for accessing
the content piece-meal. The requirement is that the resulting dedoded
object must be shareable and reusable between different consumers in
unspecified contexts. This implies that the decoded object should be
immutable or provide an immutable API.


##### 2.3.2.1. decoding "application/valaascript"

The application/valaascript decoder transpiles the octet stream into
a *module program Kuery*. This Kuery contains the rules for setting up
an ES6-like module exports. The kuery can thus be shared between
different integration contexts (different ghosts of the same base media
in different instances, etc.)


#### 2.3.2.2. decoding "application/javascript"

The application/javascript decoder wraps the octet stream text into
a native function. This function accepts a contextual global scope
object as an argument, and when called sets up an ES6-like module
exports based on the octet content interpreted as a javascript module.
Like with other interpretations, this outermost native function will be
shared between contexts.


#### 2.3.3. Decoded representation is *integrated* into a specific context

#### 2.3.3.1. integrating "application/valaascript"

When the kuery is valked against a resource and some context the valk
result is an object with ES6-style bindings of the exported symbols as
the object properties.

TODO(iridian): Define this precisely. Consult an
[analysis of CommonJS and ES Modules within NodeJS](https://medium.com/@giltayar/native-es-modules-in-nodejs-status-and-future-directions-part-i-ee5ea3001f71)
[typescript ESM default interop with CJS](https://github.com/Microsoft/TypeScript/issues/2719) and
[neufund default export ban](https://blog.neufund.org/why-we-have-banned-default-exports-and-you-should-do-the-same-d51fdc2cf2ad)
[ES6 exports immutable bindings, not values](https://github.com/rauschma/module-bindings-demo)
for some starting inspiration.


#### 2.3.3.2. integrating  "application/javascript"

The contextual global scope for the integration is a javascript global
host object associated with the context resource.


## 3. Only *universal* commands are accepted by the upstream

TODO(iridian): Update outdated documentation
Restricted proclamations are commands created by downstream components
and which target a particular partition but for which some of the relevant
data is found only in other partitions (such as a cross-partition
DUPLICATED command). Before a restricted command can be sent upstream
(from where it might reach other users which might not even have
permissions to access those other partitions) the command must be
*universalized* by explicitly adding all necessary data to the command.


## 4. Concrete components

### 4.1. The *FalseProphet* extends Corpus in-memory store with full connectivity and transactionality

### 4.2. The *Scribe* provides partition content, command queue and event log caching in IndexedDB.

### 4.3. The *Oracle* manages connection information stream routing to authorities and Scribe
