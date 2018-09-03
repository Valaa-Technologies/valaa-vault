# Valaa Open System DevOps, or how to grasp the ValOS and handle the authorities

## *IMPORTANT*

This document, like most of the more principled and less pragmatic
documents must be understood as strong speculation and as an
architectural exercise (although a very serious one) on what-could-be.

This rings especially true for the primary focus of this document, ie.
for `Valaa Open System` as the fully functional open source core around
which the often proprietary Valaa ecosystem would expand. This is an
ambitious, even presumptuous attempt to facilitate the fruitful
side-by-side living of open source communities as well as private
enterprises as a combination of technical and social architecture.

(The technical part is the ambitious part and the social part is
the presumptuous part. :D)

## 1. Introduction and ValOS specification

This document has two purposes. Firstly it provides the initial
specification of Valaa Open System (`ValOS`) and secondly it serves as
the introduction for [Development Operations](https://en.wikipedia.org/wiki/DevOps).

ValOS specification is provided as quoted and numbered ValOS rules.

> `valos-vault-1.1`: `ValOS packages` are all npmjs.com packages with
> `@valos` scope which don't have cyclic dependencies with other
> `@valos` scope packages.

> `valos-vault-1.2`: Valaa Open System (`ValOS`) is defined to be the
> contents of all ValOS packages and nothing else.

> `valos-vault-1.3`: `ValOS specification` consists of all files in all
> ValOS packages whose path in the package matches the JS regex
> `/^specifications\/\w*.md$/` and nothing else.

> `valos-vault-1.4`: Rules in a package are considered to be more
> specific than the rules in its package dependency tree. More specific
> rules take precedence.

> `valos-vault-1.5`: All packages which conform to ValOS specification
> are called `Valaa packages`. These packages are inclusively
> considered part of the `Valaa ecosystem`.

The system is structured into a plethora of purpose-oriented vertical
`domains` and into four content oriented horizontal `utility layers`.

Each utility layer is named by the content or service is provides and
builds or depends on the previous layers.
- `files` layer provides files via git repositories
- `packages` layer provides npm packages via npm registry.
   These packages are created by git repositories called `vaults`.
- `authorities` layer provides the Valaa live authority service APIs.
   Authorities are controlled by git repositories called `autholleries`.
- `partitions` layer provides the resource content as partition
   events and bvobs. These are served via authority service APIs.

TODO(iridian): Figure out and describe the concrete role of domains.

A DevOp manages these layers by scripts that are delivered inside the
packages alongside their main content. A command line tool called
Valaa Manager or `valma` is used to discover and `invoke` these
scripts as `valma commands`.

From a DevOps perspective `valma`, `vault` and `authollery` are the
three concrete core mechanisms that everything else ties into.

Valma and specific domains are specified in other documents and as such
are only briefly described here.
The utility layers are common to everything form the bulk of this
document. They are fully specified at the last part of this document
after all the brief descriptions.

## 2. ValOS `domains` are cross-stack slices, each with a well-defined purpose

> `valos-vault-2.1`: A `domain` is the collection of all the systems,
> interactions and dynamics which exclusively serve a particular
> purpose.
> `valos-vault-2.2`: A domain must define the purpose, describe its
> producers and consumers and should provide a direction for technical
> and operational structure as well.

For example the `kernel` domain provides the essential central Valaa
code for developing new Valaa infrastructure software. Its main
producers are the kernel software developers and its consumers are the
infrastructure software developers. It revolves around developing code
as library packages.

On the other hand the `infrastructure` domain provides Valaa services
on various infrastructure platforms. Its main producers are the DevOps
agents and its consumers are the ValaaSpace users. It revolves around
assembling, configuring and deploying components on live systems.

#### Of kernel and infrastructure, of software devs and DevOps agents, of roles and tasks, of extremes and continuums, or when an entrepreneur holds too many hats at once and everything transcends into facets of one grand abstraction

It is so that `kernel` is mostly about developers and the way they
check out, design, implement, test, review, integrate and publish code;
and likewise it is so that `infrastructure` is mostly about how DevOps
agents mind automation, communication, monitoring & QA, diagnostics,
reliability, risk management, gradual improvement, etc.

But it is also that `kernel` work involves DevOps concerns and that
`infrastructure` work involves software development. A software
developer must see the infrastructural ecosystem around them. Knowing
where they are currently standing is necessary to understand the impact
and consequences of their code. Likewise a DevOps agent must know about
software development best practices to support their infrastructure
development work.

A person thus is never exclusively a software developer or a DevOps
agent. Likewise also when project role calls for DevOps or when some
domain talks about a software developer these are just an indication on
how the tasks of that role are distributed in the software - operations
continuum.

## 3. `valma` - a convenience CLI to context-dependent command scripts

valma (`vlm` in CLI) is a convenience tool for executing valaa scripts
in package and repository contexts. It is a generalization of 'npx -c'
behaviour, adding discoverability, ability to invoke global scripts
and the ability to invoke multiple scripts at once using glob matching.

> `valos-vault-3.1`: valma is installed with `npm install -g valma` or
> as a package dependency.

This installs the global CLI command `vlm` (as an alias for `valma`).
At its core valma is a command dispatcher to `valma scripts` in
various `command pools`.

> `valos-vault-3.2`: valma searches the scripts first from the
> package.json `scripts` pool, then from `./node_modules/.bin/`
> `depends` pool and lastly (the OS-specific variant of) `/usr/bin`
> `global` pool.

For example typing `vlm status` in some directory context would forward
the command to `valma.bin/valma-status` first if one exists and falling
back to the more generic versions if not. The call eventually resolves
at the global `/usr/bin/valma-status`. Its implementation then calls
`vlm .status/**/*` which calls all scripts matching the glob
`.valma-status/**/*` visible on the execution context pools (these
particular scripts are commonly called `valma status scripts`).

> `valos-vault-3.3`: A package can export valma scripts using npm
> package.json `bin` section and by prefixing the exported name with
> `valma-` as usual. These scripts will be available for all packages
> depending on this package in their `depends` pool.

Running `vlm` with no arguments lists all available commands grouped by
pool in current directory context.

> `valos-vault-3.5`: valma should be used in programmatic contexts to
> run valma scripts. When done so, valma must be added as a dependency.

This happens just like with the CLI by using `vlm <command> [<args>]`.
("npx -c" would be the alternative but it's slow and limited).

> `valos-vault-3.5.1`: valma ensures that node environment is loaded

The environment is loaded only once even for recursive script
invokations.

> `valos-vault-3.5.2`: valma ensures that 'vlm' is always found in path

This is so that valma scripts can call 'vlm' even valma is not globally
installed if valma has been installed as a dependency.

> `valos-vault-3.5.3` valma ensures that the most specific 'vlm'
> version is used to evaluate a command, preferring scripts over
> depended over global.

This is so that toolkits can precisely control the whole toolchain in
their dependencies.


## 4. ValOS `utility` layer provides a particular operational service for all

ValOS has four main utility layers: `files`, `packages`, `authorities`
and `partitions`. These layers form the core operational infrastructure
of ValOS.

### 4.1. Overview of utility layers

> `valos-vault-4.1.1`: An `utility` is a domain with a well-defined
> operational purpose.

> `valos-vault-4.1.2`: utility must explicitly define the `payload` it
> provides to its consumers as well as the providers, tools and
> workflows used to manage that payload.

Below is a rough correlation of similar concepts across utilities.

Utility    |Tool          |Payload                    |Providers   |Consumed via      |Upstream|Configuration |Modified via        |Produced via       |Authority  |Distributed via
-----------|--------------|---------------------------|------------|------------------|--------|--------------|--------------------|-------------------|-----------|------------------
files      |`git`         |files in `./*`             |github.com  |`git clone`       |N/A     |`.git/*`      |`branch` `commit`   |`git push` & PR    |human      |merge PR to & `git push master`
packages   |`vlm`, `yarn` |files in `/node_modules/..`|npmjs.com   |`depend` `require`|`files` |`package.json`|ups. `src/*` `bin/*`|upstream           |hybrid     |`assemble-packages` `publish-packages`
authorities|`vlm`         |APIs, site & gateway files |IaaS, custom|browsers, various |`files` |upstream *    |upstream *          |upstream           |hybrid     |`build-release` `deploy-release`
partitions |`vlm`, gateway|event logs, bvobs          |authorities |event & bvob APIs |N/A     |N/A           |gateway prophet     |command & bvob APIs|authorities|automatic, custom

- `Utility` - the utility layer which is being described
- `Tool` - the name of the tool used to manipulate the payload and/or metadata
- `Payload` - the content or the service the utility delivers to consumers
- `Providers` - the authoritative source for the payload
- `Consumed via` - the mechanism used by a consumer to access the payload
- `Upstream` - the possible external source of payload updates
- `Configuration` - where the configuration of the utility itself is specified
- `Modifed via` - how to make local changes to the payload
- `Produced via` - how to request for a set of local changes to be distributed
- `Authority` - who accepts and distributes a change request
- `Distributed via` - how changes are made live to all consumers

Note that `files` and `partitions` don't have an external upstream and
thus these bands are the defining authority of all of their payload.

On the other hand `packages` and `authorities` use the `files` as their
external upstream: their payload is generated from the content in git
repositories. Making updates to such utility content thus requires:

1. modifying the corresponding upstream git repository
2. distributing the git changes (a PR followed with `git push master`)
3. distributing the utility update (`publish-packages` or `deploy-release`).

Step 3 can be automated by tooling in particular domains as a response
to particularily formed git repository updates.

### 4.2. Files utility layer has files committed in git repositories

[git](https://git-scm.com/) is the industry standard for version
managing sets of files in a non-centralized ecosystem. No additional
tools are provided because there is no need.

> `valos-vault-4.2.1`: ValOS tools should use git as the files
> provider.

While github.com is the de facto standard provider and the typical
choice it must *not* be _required_.

> `valos-vault-4.2.2`: All git providers must be fully supported by all
> ValOS tools and libraries.


## 4.3. Packages utility layer has shared, versioned, dependable sets of files published as npmjs.com packages

> `valos-vault-4.3.1`: The packages utility payload is [npmjs.com packages](https://docs.npmjs.com/getting-started/packages)

These packages can be libraries, toolsets or prebuilt release
runtimes - any sets of files really. The raison d'être for packages is
when several different consumers depend on the same set of files which
are also expected to undergo periodic development. The files thus need
versioning, dependency management and automated distribution - this all
is provided by npm.

Note: npmjs.com is a javascript repository - this should not be a
problem as long as ValOS remains mostly javascript and config files. If
a need to diversity the languages arises
a [private npm registry](https://docs.npmjs.com/misc/registry#can-i-run-my-own-private-registry)
can be set up for that purpose.

valma package commands: `vlm assemble-packages` `vlm publish-packages`


## 4.4. Authorities utility layer has the authority deployments on infrastructure services

> `valos-vault-4.4.1`: A Valaa `authority` is uniquely identified by an
> `authority URI`.

[Read more about Valaa URIs](packages/raem/README.md).

> `valos-vault-4.4.2`: A Valaa `authority` can contain Valaa
> `partitions` and must provide a mechanism for accessing event logs
> and bvob content as well as for accepting and authorizing incoming
> commands into authorized partition events.

Authorities are usually live deployments on some infrastructure and
they provide service APIs as the required mechanisms.

Stateless or in some way non-infrastructural authorities also exist but
are specified elsewhere (they are considered degenerate, without
upstream and with empty payload).

[Read more about authorities](packages/prophet/README.md).

> `valos-vault-4.4.3`: Authorities utility layer payload
> (`authority payload`) is a set of deployed authority service APIs and
> any associated static content.

The payload here refers to the service deployments and their live APIs
themselves and not any dynamic content delivered through them. Such
dynamic content belongs to other domains (notably ValaaSpace content
resides in the `partitions` utility layer, see below).

The static content includes HTTP landing pages, site routes and their
configurations, ValOS gateway and plugin runtimes and any other similar
statically configured files.

> `valos-vault-4.4.4`: An authority may have a valaa AUTHority
> contrOLLERr repositoRY (`authollery`) as its upstream for managing
> its payload.

Particular authorities are naturally free to implement their
operational architectures in any way they like. This said autholleries
have a well-defined structure which valma authority tools make use of.

Updates to the authority payloads are primarily done as modifications
to the corresponding authollery and then distributing those via release
deployments.

> `valos-vault-4.4.5`: An autholleriy should not be published as a
> package.

While autholleries make use of package.json and the npm dependency
management this provides, they can also contain considerable amounts of
static content. Also, there should be no reason to depend on
an authollery. Automatic release deployment systems should have access
to a authollery directly for building the release.

> `valos-vault-4.4.6`: Information must not move from deployed
> authorities back to authority utility layer upstream.

Information flowing back upstream increases complexity, prevents
decentralized and manual upstreams (there is a definite upstream which
must be always accessible), and are a security concern (for
programmatic access the downstream must have the upstream credentials).

If a use case necessitating this arises, still seriously consider
keeping the mutateable content separate from the upstream itself and
instead have upstream only contain the necessary code and credentials
to access this content.

Note: this applies to architectural decisions and automations only.
Interactive content in ValaaSpace is not limited from using an
authollery to update authorities (although it is still recommended to
keep such ValaaSpace applications deployments separate from the
authorities they are used to control).

valma authollery commands: `vlm build-release` `vlm deploy-release`


### 4.4.1. Valaa authorities vs. ValOS authorities

Valaa authorities and any partition content they provide do not need to
be public. A Valaa authority is an authority which can be accessed
using a pure ValOS gateway with no plugins or with a gateway plugin
which conforms to the gateway plugin requirements (Note: these
requirements must be specified in such a way that gateway plugins
cannot interfere with other 'reasonably' written plugins).
A ValOS authority is a Valaa authority which can be accessed using
only ValOS plugins (including no plugins at all).


## 4.5. Partitions utility layer - the foundation of ValaaSpace

Event logs and bvob content are the partitions payload and are consumed
by ValOS gateways. It is more extensively covered elsewhere and is
mentioned here for completeness; precious little infrastructural
tooling is provided for them yet.

Eventually various partition diagnostics tools will come in handy:
- Media content import/export tools
- Complete partition to file system hierarchy save/load tools
- Event log introspection and manipulation tools
- etc.


### 4.5.1. Valaa partitions vs. ValOS partitions

All partitions provided by Valaa authorities are Valaa partitions.
Additionally ValOS partitions are partitions which are both
1. provided by ValOS authorities, and
2. provided for an anonymous consumer with nothing but a client
   capable of running the ValOS gateway runtime the authority provides
   (with reasonable concessions for the authority to prevent DDOS
   attacks)

TODO(iridian): Figure out whether this is the actually most meaningful
               place to put this semantic border. A specific term for
               non-authenticated partitions capable of running only on
               standard runtime is useful, but how useful actually?


## 5. Kernel domain provides the ValOS primary libraries

It does, indeed (this section pending better understanding on how to
write domain specifications).
