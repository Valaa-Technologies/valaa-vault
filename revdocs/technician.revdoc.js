
const {
  extractee: { authors, blockquote, dfn, em, strong, ref, command, pkg },
} = require("@valos/revdoc");

module.exports = {
  "dc:title": [strong("Technicians"), ` deploy and maintain the valos fabric infrastructure`],
  "VDoc:tags": ["PRIMARY", "ROLE"],
  subProfiles: [
    "contributor", "developer", "administrator", "devops", "hacker", "etc",
  ],
  respecConfig: {
    specStatus: "unofficial",
    editors: authors("iridian"),
    authors: authors(),
    shortName: "technician",
  },
  "chapter#abstract>0": {
    "#0": [
`This document is the first introduction for ValOS technicians -
the primary infrastructure developers and operators - to the ValOS
ecosystem and its infrastructure toolchains and workflows.`,
    ],
  },
  "chapter#sotd>1": {
    "#0": [
`This document is part of the vault workspace `, pkg("@valos/kernel"), `
(of domain `, pkg("@valos/kernel"), `) which has the description:
\`ValOS common infrastructure tools and libraries monorepository\`.`,
    ],
    "example#1": `
NOTE(2019-08): This document is severely \`OUTDATED and SEMANTICALLY UNRELIABLE\`.
This content is what used to be in DEVOPS.md, is relatively old and
needs to be revised. The specification needs to be extracted to be
a separate document from the devops workflows.`,
  },
  "chapter#introduction>2;How do I enable valonauts and expand the Valospace?": {
    "#0": [
`As a technician you develop and operate the `,
dfn("ValOS fabric", "#fabric", ", ",
    `the globally distributed web-like infrastructure of servers,
    services and components which underlies the Valospace`), `.

You use `, ref("vlm", "@/valma"), ` and employ your existing,
likely professional knowledge of JavaScript, Node.js, DevOps,
backend, library and other software development skills.

You create new open source and/or proprietary node packages. These
permanently create new fabric functionalities and `, ref("expand"),
` the Valospace by integrating it to old world systems.`,
    ],
  },
  "chapter#section_profiles>3;Technician role sub-profiles": {
    "#0": [
`Technician sub-profiles detail the typical stages of software
development and operations workflows within ValOS ecosystem.
A technician should read the detail docs of their own profiles
but also understand the at least the abstract principles of all
other profiles, which are expanded below.`,
    ],
    "chapter#developer>0;How developers set up their development environments": {
      "#0": [],
    },
    "chapter#contributor>1;How contributors produce git PR's and new fabric packages": {
      "#0": [],
    },
    "chapter#tester>2;How testers assure quality before releases": {
      "#0": [],
    },
    "chapter#administrator>3;How administrators manage infrastructure resources": {
      "#0": [],
    },
    "chapter#devops>4;How DevOps workflows are implemented using valma": {
      "#0": [],
    },
    "chapter#hacker>5;How hackers have fun whilst avoiding pain": {
      "#0": [],
    },
    "chapter#etc>9;How to add new profiles": {
      "#0": [
`Create a `, ref("PR in github", "https://help.github.com/en/articles/about-pull-requests"),
` against @valos/kernel/revdocs/technician.revdoc.js`,
      ],
    },
  },
  "chapter#preface>3;*IMPORTANT": {
    "#0": [
`This document, like most of the more principled and less pragmatic
documents must be understood as strong speculation and as an
architectural exercise (although a very serious one) on
what-could-be.

This rings especially true for the primary focus of this document,
ie. for `, em("ValOS Core"), ` as the fully functional open source
core around which the often proprietary ValOS ecosystem would expand.
This is an ambitious, even presumptuous attempt to facilitate the
fruitful side-by-side living of open source communities as well as
private enterprises as a combination of technical and social
architecture.

(The technical part is the ambitious part and the social part is
the presumptuous part. :D)`,
    ],
  },
  "chapter#specification>4;ValOS specification": {
    "#0": [
`This document has two purposes. Firstly it provides the initial
specification of Valaa Open System (`, em("ValOS"), `) and secondly
it serves as the introduction for `,
ref("Development Operations", "https://en.wikipedia.org/wiki/DevOps"), `.

ValOS specification is provided as quoted and numbered ValOS rules.`,
blockquote(em("valos-vault-1.1"), ": ", em(`ValOS packages`), ` are
    all the npmjs.com packages with `, em("@valos"), ` scope which
    don't have cyclic dependencies with other `, em("@valos"), `
    scope packages.`),
blockquote(em("valos-vault-1.2"), ": Valaa Open System (",
    em(`ValOS`), ` is defined to be the contents of all ValOS
    packages and nothing else.`),
blockquote(em("valos-vault-1.3"), ": ", em(`ValOS specification`), `
    consists of all files in all ValOS packages whose path in the
    package matches the JS regex `, em(`/^specifications\\/\\w*.md$/`), `
    and nothing else.`),
blockquote(em("valos-vault-1.4"), `: Rules in a package are considered
    to be more specific than the rules in its package dependency tree.
    More specific rules take precedence.`),
blockquote(em("valos-vault-1.5"), `: All packages which conform to
    ValOS specification are called `, em("ValOS packages"), `. These
    packages are inclusively considered part of the `, em("ValOS ecosystem"), `.`), `

The system is structured into purpose-oriented vertical `, em("domains"), `
and into four content oriented horizontal `, em("utility layers"), `.

Each utility layer is named by the content or service is provides
and builds or depends on the previous layers.`,
      { "bulleted#": [
[em(`files`), ` layer provides files via git repositories.`],
[em(`packages`), ` layer provides npm packages via npm registry.
  These packages are created by git repositories called `,
  em("vaults"), "."],
[em(`authorities`), ` layer provides the ValOS live authority
  service APIs. Authorities are deployed and managed with `,
  em("opspace"), ` workspaces.`],
[em(`chronicles`), ` layer provides the resource content as
  chronicle events and bvobs. These are served via authority
  service APIs.`],
      ] }, `

TODO(iridian): Figure out and describe the concrete role of domains.
NOTE(iridian, 2019-08): Domains are now mostly figured out; they
are administrative, organisational units and namespaces.

A DevOp manages these layers by scripts that are delivered inside
the packages alongside their main content. A command line tool called
ValOS Medium or `, command("vlm"), ` is used to discover and `, em("invoke"), `
these scripts as `, em("valma commands"), `.

From a DevOps perspective `, em("valma"), `, `, em("vault"), ` and `,
em("opspace"), ` are the three concrete core mechanisms that everything
else ties into.

Valma and specific domains are specified in other documents and as such
are only briefly described here.

The utility layers are common to everything form the bulk of this
document. They are fully specified at the last part of this document
after all the brief descriptions.`,
    ],
  },
  "chapter#domains>5;ValOS `domains` are cross-stack slices, each with a well-defined purpose": {
    "#0": [
blockquote(em("valos-vault-2.1"), `: A `, em("domain"), ` is the
    collection of all the systems, interactions and dynamics which
    exclusively serve a particular purpose.`),
blockquote(em("valos-vault-2.2"), `: A domain must define the
    purpose, describe its producers and consumers and should
    provide a direction for technical and operational structure as
    well.`),
`For example the `, pkg("@valos/kernel"), ` domain provides the
essential central ValOS code for developing new ValOS
infrastructure software. Its main producers are the kernel software
developers and its consumers are the infrastructure software
developers. It revolves around developing code as library packages.`,
    ],
  },
  "chapter#valma>6;`valma` - a convenience CLI to context-dependent command scripts": {
    "#0": [
`valma (`, command("vlm"), ` in CLI) is a convenience tool for executing
command scripts exported by packages in valos workspace contexts.
It is a generalization of 'npx -c' behaviour, adding
discoverability, ability to invoke global scripts and the ability
to invoke multiple scripts at once using glob matching.`,
blockquote(em("valos-vault-3.1"), `: valma is installed with `,
    command("npm install -g valma"), ` or as a package dependency`),
`This installs the global CLI command `, command("vlm"), `. At its core
valma is a command dispatcher to `, em("valma scripts"), ` in
various `, em("command pools"), `.`,
blockquote(em("valos-vault-3.2"), `: valma searches the scripts
    first from the package.json `, em("scripts"), ` pool, then from `,
    em("./node_modules/.bin/"), em("depends"), ` pool and lastly from
    the OS-specific variant of `, em("/usr/bin"), em("global"),
    ` pool.`),
`As an example typing `, command("vlm status"), ` in some directory
context would forward the command to `, command("valma.bin/valma-status"),
` first if one exists and falling back to the more generic versions
if not. The call eventually resolves at the global `,
command("/usr/bin/valma-status"), `. Its implementation then calls `,
command("vlm .status/**/*"), ` which calls all scripts which match
the glob `, command(".status/**/*"), ` and are visible on the
execution context pools (the scripts called by `, command("vlm status"),
` are known as `, em("valma status scripts"), `).`,
blockquote(em("valos-vault-3.3"),
    `: A package can export valma scripts using npm package.json `,
    em("bin"), ` section and by prefixing the exported name with `,
    em("_vlm_"), ` as usual. These scripts will be available for
    all packages depending on this package in their `, em("depends"),
    ` pool.`),
`Running `, command("vlm"), ` with no arguments lists all available
commands grouped by pool in current directory context.`,
blockquote(em("valos-vault-3.5"),
    `: valma can be used in programmatic contexts to run valma
    scripts. When done so, valma must be added as a dependency.`),
`This happens just like with the CLI by using `, command("vlm <command> [<args>]"), `.
("npx -c" would be the alternative but it's slow and limited).`,
blockquote(em("valos-vault-3.5.1"),
    `: valma ensures that node environment is loaded`),
`The environment is loaded only once even for recursive script
invokations.`,
blockquote(em("valos-vault-3.5.2"),
    `: valma ensures that 'vlm' is always found in path`),
`This is so that valma scripts can call 'vlm' even valma is not
globally installed as long as valma has been installed as a dependency.`,
blockquote(em("valos-vault-3.5.3"),
    `: valma ensures that the most specific 'vlm' version is used
    to evaluate a command, preferring scripts over depended over global.`),
`This is so that toolkits can precisely control the whole toolchain
in their dependencies.`,
    ],
  },
  "chapter#utility_layer>7;ValOS `utility` layers provide operational services": {
    "#0": [
`ValOS has four main utility layers: `, em("files"), `, `, em("packages"), `,
`, em("authorities"), ` and `, em("chronicles"), `. These layers form
the core operational infrastructure of ValOS.`,
    ],
    "chapter#utility_layer_overview>0;Overview of utility layers": {
      "#0": [
blockquote(em("valos-vault-4.1.1"), `: An `, em("utility"), ` is a domain
    with a well-defined operational purpose.`),
blockquote(em("valos-vault-4.1.2"), `: utility must explicitly define
    the `, em("payload"), ` it provides to its consumers as well as the
    providers, tools and workflows used to manage that payload.`),
`Below is a rough correlation of similar concepts across utilities.`,
      ],
      "table#1": {
  /* eslint-disable comma-spacing, max-len */
        "VDoc:columns":
["Utility"    , "Tool"          , "Payload"                    , "Providers"   , "Consumed via"      , "Upstream", "Configuration" , "Modified via"        , "Produced via"       , "Authority"  , "Distributed via"],
        "VDoc:entries": [
["files"      , "`git`"         , "files in `./*`"             , "github.com"  , "`git clone`"       , "N/A"     , "`.git/*`"      , "`branch` `commit`"   , "`git push` & PR"    , "human"      , "merge PR to & `git push master`"],
["packages"   , "`vlm`, `yarn`" , "files in `/node_modules/..`", "npmjs.com"   , "`depend` `require`", "`files`" , "`package.json`", "ups. `src/*` `bin/*`", "upstream"           , "hybrid"     , "`assemble-packages` `publish-packages`"],
["authorities", "`vlm`"         , "APIs, site & gateway files" , "IaaS, custom", "browsers, various" , "`files`" , "upstream *"    , "upstream *"          , "upstream"           , "hybrid"     , "`build-release` `deploy-release`"],
["chronicles" , "`vlm`, gateway", "event logs, bvobs"          , "authorities" , "event & bvob APIs" , "N/A"     , "N/A"           , "gateway"             , "command & bvob APIs", "authorities", "automatic, custom"],
        ],
  /* eslint-enable comma-spacing, max-len */
      },
      "#2": [
        { "bulleted#": [
[em("Utility"), "- the utility layer which is being described"],
[em("Tool"), " - the name of the tool used to manipulate the payload and/or metadata"],
[em("Payload"), " - the content or the service the utility delivers to consumers"],
[em("Providers"), " - the authoritative source for the payload"],
[em("Consumed via"), " - the mechanism used by a consumer to access the payload"],
[em("Upstream"), " - the possible external source of payload updates"],
[em("Configuration"), " - where the configuration of the utility itself is specified"],
[em("Modifed via"), " - how to make local changes to the payload"],
[em("Produced via"), " - how to request for a set of local changes to be distributed"],
[em("Authority"), " - who accepts and distributes a change request"],
[em("Distributed via"), " - how changes are made live to all consumers"],
        ] },
`Note that `, em("files"), ` and `, em("chronicles"), ` don't have
an external upstream and thus these bands are the defining
authority of all of their payload.

On the other hand `, em("packages"), ` and `, em("authorities"), ` use
the `, em("files"), ` as their external upstream: their payload is
generated from the content in git repositories. Making updates to
such utility content thus requires:`,
        { "numbered#": [
["modifying the corresponding upstream git repository"],
[`distributing the git changes (a PR followed with `, command("git push master"), `)`],
[`distributing the utility update (`, command("publish-packages"),
  ` or `, command("deploy-release"), `).`],
        ] }, `
Step 3 can be automated by tooling in particular domains as a response
to particularily formed git repository updates.`,
      ],
    },
    "chapter#files_layer>1;Files utility layer has files committed in git repositories": {
      "#0": [
ref("git", "https://git-scm.com/"), ` is the industry standard
for version managing sets of files in a non-centralized ecosystem.
No additional tools are provided because there is no need.`,
blockquote(em("valos-vault-4.2.1"),
    `: ValOS tools should use git as the files provider.`),
`While github.com is the de facto standard provider and
the typical choice it must *not* be _required_.`,
blockquote(em("valos-vault-4.2.2"),
    `: All git providers must be fully supported by all ValOS tools and
    libraries.`),
      ],
    },
    [`chapter#packages_layer>2;Packages utility layer has shared, versioned, dependable${
        ""} sets of files published as npmjs.com packages`]: {
      "#0": [
blockquote(em("valos-vault-4.3.1"),
    `: The packages utility payload is `,
    ref("npmjs.com packages", "https://docs.npmjs.com/getting-started/packages")),
`These packages can be libraries, toolsets or prebuilt release runtimes
- any sets of files really. The raison d'être for packages is when
several different consumers depend on the same set of files which are
also expected to undergo periodic development. The files thus need
versioning, dependency management and automated distribution - this all
is provided by npm.

Note: npmjs.com is a javascript repository - this should not be
a problem as long as ValOS remains mostly javascript and config files.
If a need to diversity the languages arises a `,
ref("private npm registry",
    "https://docs.npmjs.com/misc/registry#can-i-run-my-own-private-registry"),
`can be set up for that purpose.

valma package commands: `, command("vlm assemble-packages"), ` `,
command("vlm publish-packages"),
      ],
    },
    [`chapter#authorities_layer>3;Authorities utility layer has the authority deployments${
        ""} on infrastructure services`]: {
      "#0": [
blockquote(em("valos-vault-4.4.1"),
    `: A ValOS `, em("authority"), ` is uniquely identified by an
    authority URI.`),
ref("Read more about valos URIs", "packages/raem/README.md"), `.

`, blockquote(em("valos-vault-4.4.2"),
    `: A ValOS `, em("authority"), ` can contain ValOS `,
    em("chronicles"), ` and must provide a mechanism for
    accessing event logs and bvob content as well as for
    accepting and authorizing incoming commands into authorized
    chronicle events.`),
`Authorities are usually live deployments on some
infrastructure and they provide service APIs as the required
mechanisms.

Stateless or in some way non-infrastructural authorities also exist but
are specified elsewhere (they are considered degenerate, without
upstream and with empty payload).

`, ref("Read more about authorities", "packages/sourcerer/README.md"), `.

`, blockquote(em("valos-vault-4.4.3"),
    `: Authorities utility layer payload (`, em("authority payload"), `)
    is a set of deployed authority service APIs and any associated
    static content.`),
`The payload here refers to the service deployments and their live APIs
themselves and not any dynamic content delivered through them. Such
dynamic content belongs to other domains (notably valospace content
resides in the `, em("chronicles"), ` utility layer, see below).

The static content includes HTTP landing pages, site routes and their
configurations, ValOS gateway and spindle runtimes and any other similar
statically configured files.

`, blockquote(em("valos-vault-4.4.4"), `: An authority may have
    an operations workspace (`, em("opspace"), `) as its upstream for
    managing its payload.`), `

Particular authorities are naturally free to implement their
operational architectures in any way they like. This said opspaces
have a well-defined structure which valma authority tools make use of.

Updates to the authority payloads are primarily done as modifications
to the corresponding opspace and then distributing those via release
deployments.

`, blockquote(em("valos-vault-4.4.5"), `: An opspace should not
    be published as a package.`), `

While opspaces make use of package.json and the npm dependency
management this provides, they can also contain considerable amounts of
static content. Also, there should be no reason to depend on an opspace.
Automatic release deployment systems should have access to a opspace
directly for building the release.

`, blockquote(em("valos-vault-4.4.6"), `: Information must not move
    from deployed authorities back to authority utility layer
    upstream.`), `

Information flowing back upstream increases complexity, prevents
decentralized and manual upstreams (there is a definite upstream which
must be always accessible), and are a security concern (for
programmatic access the downstream must have the upstream credentials).

If a use case necessitating this arises, still seriously consider
keeping the mutateable content separate from the upstream itself and
instead have upstream only contain the necessary code and credentials
to access this content.

Note: this applies to architectural decisions and automations only.
Interactive content in valospace is not limited from using an opspace
to update authorities (although it is still recommended to keep such
valospace applications deployments separate from the authorities they
are used to control).

valma opspace commands: `, command("vlm build-release"), ` `,
command("vlm deploy-release"),
      ],
      "chapter#>0;ValOS core vs. auxiliary authorities": {
        "#0": [
`ValOS authorities and any chronicle content they provide do not need
to be public. A ValOS core authority is an authority which can be
accessed using only ValOS core spindles (including no spindles at all).

A ValOS auxiliary authority is an authority which requires a conforming
but non-core ValOS gateway spindle in order to be accessed.`,
        ],
        "example#1":
`Design Note 2019-03: the spindle conformance requirements are
unspecified. When they are specified they must be lenient enough to
enable sophisticated protocols but constrained/sandboxed enough that
such spindles cannot interfere with other reasonably written spindles.`,
      },
    },
    "chapter#chronicles_layer>4;Chronicles utility layer - the foundation of valospace": {
      "#0": [
`Event logs and bvob content are the chronicles payload and are
consumed by ValOS gateways. It is more extensively covered elsewhere
and is mentioned here for completeness; precious little infrastructural
tooling is provided for them yet.

Eventually various chronicle diagnostics tools will come in handy:`,
        { "bulleted#": [
["Media content import/export tools"],
["Complete chronicle to file system hierarchy save/load tools"],
["Event log introspection and manipulation tools"],
["etc."],
        ] },
      ],
      "chapter#>0;ValOS public vs protected chronicles": {
        "#0": [
`All chronicles provided by ValOS authorities are ValOS chronicles.
Additionally ValOS public chronicles are chronicles which are both`,
          { "numbered#": [
["provided by ValOS core authorities, and"],
[`are available for an anonymous consumer with nothing but a client
  capable of running the ValOS gateway runtime which the authority
  itself provides (with reasonable concessions for the authority to
  prevent DDOS attacks)`],
          ] },
        ],
        "example#1":
`TODO(iridian): Figure out whether this is actually the most meaningful
place to assign this semantic border. A specific term for
non-authenticated chronicles capable of running only on standard
runtime is useful, but how useful actually?`,
      },
    },
  },
  "chapter#>8;Kernel domain provides the ValOS primary libraries": {
    "#0": [
`It does, indeed (this section pending better understanding on how to
write domain specifications).`
    ],
  },
};
