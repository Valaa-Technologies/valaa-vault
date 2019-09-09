
const {
  extractee: { c, authors, blockquote, dfn, ref, command, pkg },
} = require("@valos/revdoc");

module.exports = {
  "dc:title": `"I am a ValOS technician, I want to enable valonauts and expand valospace"`,
  "vdoc:tags": ["PRIMARY", "ROLE"],
  subProfiles: [
    "contributor", "developer", "administrator", "devops", "hacker", "etc",
  ],
  respecConfig: {
    specStatus: "unofficial",
    editors: authors("iridian"),
    authors: authors(),
    shortName: "technician",
  },
  "chapter#abstract>0": [
    `This document is the first introduction for ValOS technicians -
    the primary infrastructure developers and operators - to the ValOS
    ecosystem and its infrastructure toolchains and workflows.`,
  ],
  "chapter#sotd>1": [
    "This document is part of the vault workspace ",
    pkg("@valos/kernel"),
    " (of domain ", pkg("@valos/kernel"), ") which is ",
    "ValOS common infrastructure tools and libraries monorepository.",
    null,
    `NOTE(2019-08): This content is what used to be in DEVOPS.md,
    is relatively old and needs to undergo revision of details, of
    the emphasis, and the specification needs to be extracted to a
    separate document. The essential content is correct, though.`,
  ],
  "chapter#introduction>2;How do I enable valonauts and expand the Valospace?": [
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
    "chapter#etc>9;How to add new profiles": [
      `Create a `, ref("PR in github", "https://help.github.com/en/articles/about-pull-requests"),
      ` against @valos/kernel/revdocs/technician.revdoc.js`,
    ],
  },
  "chapter#preface>3;*IMPORTANT": [
    `This document, like most of the more principled and less pragmatic
    documents must be understood as strong speculation and as an
    architectural exercise (although a very serious one) on
    what-could-be.

    This rings especially true for the primary focus of this document,
    ie. for `, c("ValOS Core"), ` as the fully functional open source
    core around which the often proprietary ValOS ecosystem would expand.
    This is an ambitious, even presumptuous attempt to facilitate the
    fruitful side-by-side living of open source communities as well as
    private enterprises as a combination of technical and social
    architecture.

    (The technical part is the ambitious part and the social part is
    the presumptuous part. :D)`,
  ],
  "chapter#specification>4;ValOS specification": [
    `This document has two purposes. Firstly it provides the initial
    specification of Valaa Open System (`, c("ValOS"), `) and secondly
    it serves as the introduction for `,
    ref("Development Operations", "https://en.wikipedia.org/wiki/DevOps"), `.

    ValOS specification is provided as quoted and numbered ValOS rules.`,
    blockquote(c("valos-vault-1.1"), ": ", c(`ValOS packages`), `are
        all the npmjs.com packages with `, c("@valos"), ` scope which
        don't have cyclic dependencies with other `, c("@valos"),
        ` scope packages.`),
    blockquote(c("valos-vault-1.2"), ": Valaa Open System (",
        c(`ValOS`), ` is defined to be the contents of all ValOS
        packages and nothing else.`),
    blockquote(c("valos-vault-1.3"), ": ", c(`ValOS specification`),
        ` consists of all files in all ValOS packages whose path in the
        package matches the JS regex `, c(`/^specifications\\/\\w*.md$/`),
        ` and nothing else.`),
    blockquote(c("valos-vault-1.4"), `: Rules in a package are
        considered to be more specific than the rules in its package
        dependency tree. More specific rules take precedence.`),
    blockquote(c("valos-vault-1.5"), `: All packages which conform to
        ValOS specification are called `, c("ValOS packages"), `. These
        packages are inclusively considered part of the `,
        c("ValOS ecosystem"), `.`),
    `The system is structured into a plethora of purpose-oriented
    vertical `, c("domains"), ` and into four content oriented
    horizontal `, c("utility layers"), `.

    Each utility layer is named by the content or service is provides
    and builds or depends on the previous layers.`,
    { "bulleted#": [
      [c(`files`), ` layer provides files via git repositories.`],
      [c(`packages`), ` layer provides npm packages via npm registry.
        These packages are created by git repositories called `,
        c("vaults"), "."],
      [c(`authorities`), ` layer provides the ValOS live authority
        service APIs. Authorities are deployed and managed with `,
        c("opspace"), ` workspaces.`],
      [c(`partitions`), ` layer provides the resource content as
        partition events and bvobs. These are served via authority
        service APIs.`],
    ] }, `

    TODO(iridian): Figure out and describe the concrete role of domains.
    NOTE(iridian, 2019-08): Domains are now mostly figured out; they
    are administrative, organisational units and namespaces.

    A DevOp manages these layers by scripts that are delivered inside
    the packages alongside their main content. A command line tool
    called ValOS Medium or `, c("vlm"), ` is used to discover and `,
    c("invoke"), ` these scripts as `, c("valma commands"), `.

    From a DevOps perspective `, c("valma"), `, `, c("vault"), ` and `,
    c("opspace"), ` are the three concrete core mechanisms that
    everything else ties into.

    Valma and specific domains are specified in other documents and as such
    are only briefly described here.
    The utility layers are common to everything form the bulk of this
    document. They are fully specified at the last part of this document
    after all the brief descriptions.`,
  ],
  "chapter#domains>5;ValOS `domains` are cross-stack slices, each with a well-defined purpose": [
    blockquote(c("valos-vault-2.1"), `: A `, c("domain"), ` is the
        collection of all the systems, interactions and dynamics which
        exclusively serve a particular purpose.`),
    blockquote(c("valos-vault-2.2"), `: A domain must define the
        purpose, describe its producers and consumers and should
        provide a direction for technical and operational structure as
        well.`),
    `For example the `, ref("@valos/kernel"), ` domain provides the
    essential central ValOS code for developing new ValOS
    infrastructure software. Its main producers are the kernel software
    developers and its consumers are the infrastructure software
    developers. It revolves around developing code as library packages.`,
  ],
  "chapter#valma>6;`valma` - a convenience CLI to context-dependent command scripts": [
    `valma (`, c("vlm"), ` in CLI) is a convenience tool for executing
    command scripts exported by packages in valos workspace contexts.
    It is a generalization of 'npx -c' behaviour, adding
    discoverability, ability to invoke global scripts and the ability
    to invoke multiple scripts at once using glob matching.`,
    blockquote(c("valos-vault-3.1"), `: valma is installed with `,
        command("npm install -g valma"), ` or as a package dependency`),
    `This installs the global CLI command `, c("vlm"), `. At its core
    valma is a command dispatcher to `, c("valma scripts"), ` in
    various `, c("command pools"), `.`,
    blockquote(c("valos-vault-3.2"), `: valma searches the scripts
        first from the package.json `, c("scripts"), ` pool, then from `,
        c("./node_modules/.bin/"), c("depends"), ` pool and lastly from
        the OS-specific variant of `, c("/usr/bin"), c("global"),
        ` pool.`),
    `As an example typing `, command("vlm status"), ` in some directory
    context would forward the command to `, command("valma.bin/valma-status"),
    ` first if one exists and falling back to the more generic versions
    if not. The call eventually resolves at the global `,
    command("/usr/bin/valma-status"), `. Its implementation then calls `,
    command("vlm .status/**/*"), ` which calls all scripts which match
    the glob `, command(".valma-status/**/*"), ` and are visible on the
    execution context pools (the scripts called by `, command("vlm status"),
    ` are known as `, c("valma status scripts"), `).`,
    blockquote(c("valos-vault-3.3"),
        `: A package can export valma scripts using npm package.json `,
        c("bin"), ` section and by prefixing the exported name with `,
        c("valma-"), ` as usual. These scripts will be available for
        all packages depending on this package in their `, c("depends"),
        ` pool.`),
    `Running `, c("vlm"), ` with no arguments lists all available
    commands grouped by pool in current directory context.`,
    blockquote(c("valos-vault-3.5"),
        `: valma can be used in programmatic contexts to run valma
        scripts. When done so, valma must be added as a dependency.`),
    `This happens just like with the CLI by using `, c("vlm <command> [<args>]"), `.
    ("npx -c" would be the alternative but it's slow and limited).`,
    blockquote(c("valos-vault-3.5.1"),
        `: valma ensures that node environment is loaded`),
    `The environment is loaded only once even for recursive script
    invokations.`,
    blockquote(c("valos-vault-3.5.2"),
        `: valma ensures that 'vlm' is always found in path`),
    `This is so that valma scripts can call 'vlm' even valma is not
    globally installed as long as valma has been installed as a dependency.`,
    blockquote(c("valos-vault-3.5.3"),
        `: valma ensures that the most specific 'vlm' version is used
        to evaluate a command, preferring scripts over depended over global.`),
    `This is so that toolkits can precisely control the whole toolchain
    in their dependencies.`,
  ],
  "chapter#utility_layer>7;ValOS `utility` layers provide operational services": {
    "#0": [
      `ValOS has four main utility layers: `, c("files"), `, `, c("packages"),
      `, `, c("authorities"), ` and `, c("partitions"), `. These layers
      form the core operational infrastructure of ValOS.`,
    ],
    "chapter#utility_layer_overview>0;Overview of utility layers": [
      blockquote(c("valos-vault-4.1.1"), `: An `, c("utility"), ` is
          a domain with a well-defined operational purpose.`),
      blockquote(c("valos-vault-4.1.2"), `: utility must explicitly
          define the `, c("payload"), ` it provides to its consumers as
          well as the providers, tools and workflows used to manage
          that payload.`),
      `Below is a rough correlation of similar concepts across utilities.`,
      {
        /* eslint-disable comma-spacing */
        "vdoc:headers":
          ["Utility"    , "Tool"          , "Payload"                    , "Providers"   , "Consumed via"      , "Upstream", "Configuration" , "Modified via"        , "Produced via"       , "Authority"  , "Distributed via"],
        "vdoc:entries": [
          ["files"      , "`git`"         , "files in `./*`"             , "github.com"  , "`git clone`"       , "N/A"     , "`.git/*`"      , "`branch` `commit`"   , "`git push` & PR"    , "human"      , "merge PR to & `git push master`"],
          ["packages"   , "`vlm`, `yarn`" , "files in `/node_modules/..`", "npmjs.com"   , "`depend` `require`", "`files`" , "`package.json`", "ups. `src/*` `bin/*`", "upstream"           , "hybrid"     , "`assemble-packages` `publish-packages`"],
          ["authorities", "`vlm`"         , "APIs, site & gateway files" , "IaaS, custom", "browsers, various" , "`files`" , "upstream *"    , "upstream *"          , "upstream"           , "hybrid"     , "`build-release` `deploy-release`"],
          ["partitions" , "`vlm`, gateway", "event logs, bvobs"          , "authorities" , "event & bvob APIs" , "N/A"     , "N/A"           , "gateway"             , "command & bvob APIs", "authorities", "automatic, custom"],
        ],
        /* eslint-enable comma-spacing */
      },
      null,
      { "bulleted#": [
        [c("Utility"), "- the utility layer which is being described"],
        [c("Tool"), " - the name of the tool used to manipulate the payload and/or metadata"],
        [c("Payload"), " - the content or the service the utility delivers to consumers"],
        [c("Providers"), " - the authoritative source for the payload"],
        [c("Consumed via"), " - the mechanism used by a consumer to access the payload"],
        [c("Upstream"), " - the possible external source of payload updates"],
        [c("Configuration"), " - where the configuration of the utility itself is specified"],
        [c("Modifed via"), " - how to make local changes to the payload"],
        [c("Produced via"), " - how to request for a set of local changes to be distributed"],
        [c("Authority"), " - who accepts and distributes a change request"],
        [c("Distributed via"), " - how changes are made live to all consumers"],
      ] },
      `Note that `, c("files"), ` and `, c("partitions"), ` don't have
      an external upstream and thus these bands are the defining
      authority of all of their payload.

      On the other hand `, c("packages"), ` and `, c("authorities"),
      ` use the `, c("files"), ` as their external upstream: their payload is
      generated from the content in git repositories. Making updates to
      such utility content thus requires:`,
      null,
      { "numbered#": [
        ["modifying the corresponding upstream git repository"],
        [`distributing the git changes (a PR followed with `, command("git push master"), `)`],
        [`distributing the utility update (`, command("publish-packages"),
          ` or `, command("deploy-release"), `).`],
      ] },
      null,
      `Step 3 can be automated by tooling in particular domains as
      a response to particularily formed git repository updates.`,
    ],
    "chapter#files_layer>1;Files utility layer has files committed in git repositories": [
      ref("git", "https://git-scm.com/"), ` is the industry standard
      for version managing sets of files in a non-centralized ecosystem.
      No additional tools are provided because there is no need.`,
      blockquote(c("valos-vault-4.2.1"),
          `: ValOS tools should use git as the files provider.`),
      `While github.com is the de facto standard provider and
      the typical choice it must *not* be _required_.`,
      blockquote(c("valos-vault-4.2.2"),
          `: All git providers must be fully supported by all ValOS
          tools and libraries.`),
    ],
    [`chapter#packages_layer>2;Packages utility layer has shared, versioned, dependable${
        ""} sets of files published as npmjs.com packages`]: [
      blockquote(c("valos-vault-4.3.1"),
          `: The packages utility payload is `,
          ref("npmjs.com packages", "https://docs.npmjs.com/getting-started/packages")),
      `These packages can be libraries, toolsets or prebuilt release
      runtimes - any sets of files really. The raison d'être for
      packages is when several different consumers depend on the same
      set of files which are also expected to undergo periodic
      development. The files thus need versioning, dependency
      management and automated distribution - this all is provided by
      npm.

      Note: npmjs.com is a javascript repository - this should not be a
      problem as long as ValOS remains mostly javascript and config
      files. If a need to diversity the languages arises a `,
      ref("private npm registry",
          "https://docs.npmjs.com/misc/registry#can-i-run-my-own-private-registry"),
      `can be set up for that purpose.

      valma package commands: `, command("vlm assemble-packages"), ` `,
      command("vlm publish-packages"),
    ],
    [`chapter#authorities_layer>3;Authorities utility layer has the authority deployments${
        ""} on infrastructure services`]: {
      "#0": [
        blockquote(c("valos-vault-4.4.1"),
            `: A ValOS `, c("authority"), ` is uniquely identified by an
            authority URI.`),
        ref("Read more about valos URIs", "packages/raem/README.md"), `.

        `, blockquote(c("valos-vault-4.4.2"),
            `: A ValOS `, c("authority"), ` can contain ValOS `,
            c("partitions"), ` and must provide a mechanism for
            accessing event logs and bvob content as well as for
            accepting and authorizing incoming commands into authorized
            partition events.`),
        `Authorities are usually live deployments on some
        infrastructure and they provide service APIs as the required
        mechanisms.

        Stateless or in some way non-infrastructural authorities also exist but
        are specified elsewhere (they are considered degenerate, without
        upstream and with empty payload).

        `, ref("Read more about authorities", "packages/sourcerer/README.md"), `.

        `, blockquote(c("valos-vault-4.4.3"),
            `: Authorities utility layer payload (`, c("authority payload"),
            `) is a set of deployed authority service APIs and any
            associated static content.`),
        `The payload here refers to the service deployments and their live APIs
        themselves and not any dynamic content delivered through them. Such
        dynamic content belongs to other domains (notably valospace content
        resides in the `, c("partitions"), ` utility layer, see below).

        The static content includes HTTP landing pages, site routes and their
        configurations, ValOS gateway and spindle runtimes and any other similar
        statically configured files.

        `, blockquote(c("valos-vault-4.4.4"), `: An authority may have
            an operations workspace (`, c("opspace"), `) as its
            upstream for managing its payload.`), `

        Particular authorities are naturally free to implement their
        operational architectures in any way they like. This said opspaces
        have a well-defined structure which valma authority tools make use of.

        Updates to the authority payloads are primarily done as modifications
        to the corresponding opspace and then distributing those via release
        deployments.

        `, blockquote(c("valos-vault-4.4.5"), `: An opspace should not
            be published as a package.`), `

        While opspaces make use of package.json and the npm dependency
        management this provides, they can also contain considerable amounts of
        static content. Also, there should be no reason to depend on
        an opspace. Automatic release deployment systems should have access
        to a opspace directly for building the release.

        `, blockquote(c("valos-vault-4.4.6"), `: Information must not
            move from deployed authorities back to authority utility
            layer upstream.`), `

        Information flowing back upstream increases complexity,
        prevents decentralized and manual upstreams (there is a
        definite upstream which must be always accessible), and are
        a security concern (for programmatic access the downstream must
        have the upstream credentials).

        If a use case necessitating this arises, still seriously
        consider keeping the mutateable content separate from the
        upstream itself and instead have upstream only contain the
        necessary code and credentials to access this content.

        Note: this applies to architectural decisions and automations
        only. Interactive content in valospace is not limited from
        using an opspace to update authorities (although it is still
        recommended to keep such valospace applications deployments
        separate from the authorities they are used to control).

        valma opspace commands: `, c("vlm build-release"), ` `,
        c("vlm deploy-release"),
      ],
      "chapter#>0;ValOS core vs. auxiliary authorities": [
        `ValOS authorities and any partition content they provide do
        not need to be public. A ValOS core authority is an authority
        which can be accessed using only ValOS core spindles (including
        no spindles at all). A ValOS auxiliary authority is an authority
        which requires a conforming but non-core ValOS gateway spindle
        in order to be accessed. (Design Note 2019-03: the spindle
        conformance requirements are unspecified. When they are
        specified they must be lenient enough to enable sophisticated
        protocols but constrained/sandboxed enough that such spindles
        cannot interfere with other reasonably written spindles).`,
      ],
    },
    "chapter#partitions_layer>4;Partitions utility layer - the foundation of valospace": {
      "#0": [
        `Event logs and bvob content are the partitions payload and are
        consumed by ValOS gateways. It is more extensively covered
        elsewhere and is mentioned here for completeness; precious
        little infrastructural tooling is provided for them yet.

        Eventually various partition diagnostics tools will come in handy:`,
        { "bulleted#": [
          "Media content import/export tools",
          "Complete partition to file system hierarchy save/load tools",
          "Event log introspection and manipulation tools",
          "etc.",
        ] },
      ],
      "chapter#>0;ValOS public vs protected partitions": [
        `All partitions provided by ValOS authorities are ValOS
        partitions. Additionally ValOS public partitions are partitions
        which are both`,
        { "numbered#": [
          "provided by ValOS core authorities, and",
          `are available for an anonymous consumer with nothing but
          a client capable of running the ValOS gateway runtime which
          the authority itself provides (with reasonable concessions
          for the authority to prevent DDOS attacks)`,
        ] },
        `TODO(iridian): Figure out whether this is the actually most
                        meaningful place to put this semantic border.
                        A specific term for non-authenticated
                        partitions capable of running only on standard
                        runtime is useful, but how useful actually?`,
      ],
    },
  },
  "chapter#>8;Kernel domain provides the ValOS primary libraries": {
    "#0": [
      `It does, indeed (this section pending better understanding on
      how to write domain specifications).`
    ],
  },
};
