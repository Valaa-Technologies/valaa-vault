# @valos/kernel provides `ValOS` - the Valaa Open System

Distributed platform of platforms, with minimal threshold of entry
for creating applications with familiar HTML5/CSS/JS and then
deploying, sharing and reusing not just the applications themselves,
but modules and the content as well, using a unified, powerful
resource model.

## [ValOS specification and DevOps guide](DEVOPS.md)

[Important but not first reading material](DEVOPS.md).

## Community

Valaa Open System is open source software released under
[an MIT license](https://github.com/ValaaLabs/inspire/blob/master/LICENSE).

### Contributing

For the time being contact iridian at valaa dot com.

### Style guide is a combination of machine and human readable rules

Specified in [the shared eslint configuration](packages/type-vault/shared/.eslintrc.js)


## @valos/kernel vault as github.com/valaatech/vault

@valos/kernel vault has three main roles:

- it contains all `@valos` ecosystem specification documents (very WIP
  but can be found at various states of obsolescence at `DEVOPS.md` and
  the various `packages/*/README.md`).
- it provides a locally deployable and thusly restricted,
  non-persisting but fully functional ValOS gateway stack for hot and
  rapid testing and development purposes.
- it is a [monorepo](https://medium.com/@luisvieira_gmr/building-large-scale-react-applications-in-a-monorepo-91cd4637c131)
  of all `@valos` namespace library and devops npmjs.com packages.

The `@valos` namespace library packages consists of the main gateway
`@valos/inspire` and its dependencies  `@valos/tools`, `@valos/raem`,
`@valos/script`, `@valos/sourcerer` and `@valos/engine`.
The devops packages consists of the valos infrastructure manager tool
`valma` (sans namespace) and various toolset packages for managing
development environments, publishing packages and creating deployments
alike.


## Local deployment of the restricted ValOS stack with local Zero

You need to have yarn installed. If you have npm already then you can
get it with `sudo npm install -g yarn`.

Local development web server can be launched like so:
```
yarn install
npm start
```

This launches webpack-dev-server at 0.0.0.0:8080 which serves the
`Inspire Gateway` javascript runtime to the client browser accessing
it. The gateway will deliver `Zero Editor` as its `valospace` entry
site (which sourced locally from `./revelations/local-zero`).

### No remote authority spindles - limited persistence

local-zero supports only `valaa-local:` and `valaa-memory:` schemes, so
no remote content can be accessed. All content that is created is
persisted only locally inside the client browser IndexedDB cache.
`valospace` content will thus survive page refreshes but can still be
unpredictably lost. This can happen for example when the browser
clears its cache for new space.


## Overview - what is valospace

Most of the ValOS infrastructure logic lies within the sub-modules of
the Inspire client gateway. The gateway is a javascript bundle running
in the user browsers, serving various ValOS applications to the users.

These applications are created as combinations of ValOS resources which
are stored in a globally shared conceptual `valospace`. The physical
storage of individual resources varies based on the implementation of
their `authority`. But as
1. the resource identifiers are provably, auditably globally unique,
2. the resources are locateable,
3. unrestricted cross-references are possible, and
4. all ValOS resources share the same object model,
together these qualities unifies `valospace` as the most consequential
domain for all of ValOS content.

In order to efficiently present these applications to the gateway
loads only small parts of the whole valospace (called `chronicles`)
inside the user's browser. It accomplishes this using `event streams`.

### Event stream circle of life

Inspire client connects to selected chronicles inside remote
`authorities` to receive application and content event streams. It
then locally interprets these events as ValOS resources which contain
the structure, code, UI components and data all together making up the
application. Inspire then renders these to the user as a fully locally
interactive web page.

When user then interacts with the application and makes a modification
which should affect other users, Inspire sends this modification to
the appropriate remote authority as a `command`. The authority can
then authorize this command as a new event as part of its event stream.
When doing so the authority sends the new event to all other clients
who were registered to the content, thus completing the circle.

Everything that happens or is created in valospace is created using
this cycle. Zero, the primary valospace content editor, is merely
another ValOS application rendered by Inspire and has indeed been
primarily developed using itself (after a brief bootstrapping phase).

### Backend authorities can be simple

A minimal but complete backend authority needs to be two things:

- An `event sourcing` pub-sub hub and event log provider; to be able
  authorize (or reject) incoming commands into events and then publish
  these to clients who are subscribed to the relevant `chronicles`, as
  well as provide full event logs when requested
- An immutable binary hosting provider: to receive bvob content which
  is referred to by above events and then later deliver the content to
  clients requesting it.

Backend authorities are allowed and in fact expected to be much more
than this. Nevertheless, when even such minimal authorities are
combined with a way to deliver the Inspire runtime to users this
completes ValOS as a fully self-contained platform.

Note: tools for managing reference authority deplyoments will likely
be contained in a separate repository (as valma).


## Monorepo of primary ValOS packages

For ease of development all primary ValOS packages still exist in the
same repository. Some of them might be gradually separated but as long
as they remain their version numbers will progress in lock-step.

@valos/inspire is the top level entry point of the local development
environment `Inspire Gateway`.

These packages have similarities in their structure. Those extending
the schema provide a root-level ContentAPI.js. Several modules
provide an incremental test harness under */test/*TestHarness.
@valos/tools contains assorted generic tools. All packages share:

- dev-depends: `jest`, `eslint`, `flow`, `babel`, `webpack`, `npm`
- depends: `lodash`, `graphql`, `es5`, `various polyfills`
- concepts: `event sourcing`, `distributed infrastructure`, `es6`


### @valos/raem provides ValOS Resources And Events Model `ValOS-RAEM` (/vælɑːɹɛem/)

Provides the central ValOS technologies: the ValOS Resource Model and
the ValOS Event Model. Provides the connection between these in the
form of `reducers` which convert event streams into in-memory ValOS
resources and their updates. Provides schema definitions for `Resource`
and other essential ValOS resource model interfaces. Provides a kuery
language `VALK` for accessing and making limited manipulations to the
resources. Provides the low level APIs for manipulating chronicles.
Implements `ghost instancing` for the ValOS resource model;
a generalization extension of the traditional prototypical inheritance
which recursively inherits the sub-components of the prototype as
transparent but selectively modifiable `ghosts`. Provides referential
integrity to the resource model via `couplings`.

- depends: `@valos/tools`, `immutable`
- exports: `Corpus`, `Command`, `VALK`, `RAEMContentAPI`
- valosheath: `Resource`, `TransientFields`, `Bvob`, `Chronicle`
- concepts: `ghost instancing`, `chronicles`, `couplings`


### @valos/script extends JavaScript with ValOS-RAEM as `valoscript`

Valoscript is a semantic, non-syntactic extension of JavaScript which
seamlessly integrates ValOS resources with the JavaScript object model.
Bridges the gap between JavaScript model and ValOS-RAEM by considerably
extending the schema. Provides an implementation for valoscript via
transpiling into VALK kueries as an intermediate language.

- depends: `@valos/raem`, `acorn`
- exports: `transpileValoscript`, `VALSK`, `ScriptContentAPI`
- valosheath: `Scope`, `Property`
- concepts: `ECMAScript2015`, `scope`, `transpilation`


### @valos/sourcerer provides ValOS-RAEM stream components

Provides event stream connectivity. This is not just to remote
authorities but also to local browser `IndexedDB` storage. Provides
a non-authoritative in-memory repository `FalseProphet`, which wraps
@valos/raem and @valos/script. Provides command queueing and reformation
capabilities. Provides a client-side `ACID` `transaction` framework
with transparent valoscript integration. Provides bvob content
caching and management pathways. Extends the schema with folder-like
structure as well as relation-like connectivity. Together these
provide fully offline mode readiness. Provides the backend event
stream  connectivity reference implementation with AWS using simple
REST lambdas and the AWS mqtt IoT as event pub-sub.

- depends: `@valos/script`, `IndexedDB`, `AWS IoT/S3/DynamoDB`
- exports: `FalseProphet`, `Connection`, `SourcererContentAPI`
- valosheath: `SourceredNode`, `Entity`, `Media`, `Relation`,
  `SourcerableNode`
- concepts: `ACID`, `authorities`, `pub-sub`, `offline readiness`


### @valos/engine provides the ValOS-RAEM object mapper and computation engine

Provides the live proxies (`Vrappers`) to valospace resources with
`Engine`. Completes the modifcation and transaction frameworks
with the ability to create commands with the proxy objects. Provides
Media content decoder framework, which allows converting
valoscript content inside valospace into executable code. This also
allows integrating existing javascript code through valoscript
seamless integration. Converts events into subscriber callbacks calls.
Together these enable fully live-updating valoscript code via VALK
kueries as intermediate language. Exposes valoscript standard API
into valospace as `valos` execution environment global scope
primitive, with which valoscript programs have full control over
computation, stream connectivity and rendering environment inside the
browser.

- depends: `@valos/sourcerer`
- exports: `Engine`, `Vrapper`, `VALEK`
- valosheath: `valos.*`, `Object integration`
- concepts: `live kuery`, `code-as-content`, `3rd party libraries`


### @valos/inspire provides the ValOS browser gateway and DOM UI renderer

Provides the runtime entry point and UI rendering integration using
`React`. Sets up the full ValOS gateway stack. Manages initial
authentication and connects to the entry chronicle. Sets up the
rendering module, attaches it to DOM and renders the entry chronicle
`LENS`. Renders resources using attached `lens` Media files. Introduces
a Media type `VSX` (similar to `JSX`) specifically for this purpose,
which allows writing natural HTML but also embedding it with fully live
valoscript snippets. With promise-enabled rendering enables fully
dynamic valospace integration with the UI.

- depends: `@valos/engine`, `React`, `brace`
- exports: `createInspireClient`,
- valosheath: `Valoscope`, `If`, `ForEach`, `TextFileEditor`
- concepts: `model-view`, `HTML5/CSS/JS`, `rapid devevelopment`


## The promise and the claim

Client-side computation, fully self-referential unified resource
model, fundamentally live UI, full library integrations together with
scalable distributed event sourcing based infrastructure enables
uncompromising, no barrier of entry back-to-the-HTML5/CSS/JS-roots
hyper-rapid but still genuinely sustainable software development.

Let's see if this is true. _o/
