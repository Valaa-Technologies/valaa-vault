# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.37.0-alpha.5](https://github.com/valaatech/kernel/compare/v0.37.0-alpha.4...v0.37.0-alpha.5) (2021-01-18)


### Bug Fixes

* ProphecyOperation swallows unrecoverable errors ([8815fbc](https://github.com/valaatech/kernel/commit/8815fbc2e917ea56d10c28e852ba25091749b7c6))
* Universalization 'undefined' leak, missing INVALIDATED command.id ([5c0f220](https://github.com/valaatech/kernel/commit/5c0f2205fb2c5b9b1cb3cb7c3882279ee7768c22))
* Various minor bugs ([c47ec68](https://github.com/valaatech/kernel/commit/c47ec6882f5d9dffcce3922896d904b644a097a5))


### Features

* Add @valos/security library for containing valos security primitives ([338d31d](https://github.com/valaatech/kernel/commit/338d31d4147034233b3dec61c93ee12e583295d7))
* Add AuthorAspect and use tweetnacl for signing events ([6022c18](https://github.com/valaatech/kernel/commit/6022c18531286ed2511c3bb5b8aab88ec00ed747))
* Add INVALIDATED, SEALED event types as reaction to invalid truths ([3826594](https://github.com/valaatech/kernel/commit/38265943315e7f48d879e2e4f2257135dfa17c81))
* Disable author aspect and validation for non-remote authorities ([3f1eaf3](https://github.com/valaatech/kernel/commit/3f1eaf37b17f1f1afbef428e4b82cb944594df31))
* Enable vplotHashV0 only when VChronicle:requireAuthoredEvents is set ([2d0d3a7](https://github.com/valaatech/kernel/commit/2d0d3a7b993e2f014eb0b8410cb4e74c922c5115))
* Implement 'fixed' resource fields (was known as 'structural') ([948d274](https://github.com/valaatech/kernel/commit/948d27411371025950e10d19f67cf1eb07b1d5e6))
* Refuse to profess non-authorable outgoing events ([89367fc](https://github.com/valaatech/kernel/commit/89367fcc44b2a23b286f120c645226303df0a188))
* Seals a chronicle on an obnoxiously authorized yet non-authored event ([07d7807](https://github.com/valaatech/kernel/commit/07d7807da9b6476dbc24049efcde5abc7115a3c3))
* Seals on a subversive privilege bypass event ([e3008f1](https://github.com/valaatech/kernel/commit/e3008f106ad4e9317ee6c9f1de422a5ef433430a))
* Seals on an anachronistic crypto chain breaking event ([45c4c8c](https://github.com/valaatech/kernel/commit/45c4c8cbd2bb9deda9fc1232643880e51a070601))
* Seals on an impersonating director resource modification ([be34c0d](https://github.com/valaatech/kernel/commit/be34c0d4abcb220896fd3018baaecc75329d5800))
* Seals on deceptively authorized but incorrectly signed event ([28c5627](https://github.com/valaatech/kernel/commit/28c5627006758419cbb57ce98d664454c7b588cb))
* Sourcerer.resolveReference ([4f8c6b3](https://github.com/valaatech/kernel/commit/4f8c6b3d4644777547eb8532b10aeb9042597b18))
* valos.identity.createAuthorKeys ([79d48e3](https://github.com/valaatech/kernel/commit/79d48e39e55be52f050c1b1e4c7d8a22d267c18b))





# [0.37.0-alpha.4](https://github.com/valaatech/kernel/compare/v0.37.0-alpha.3...v0.37.0-alpha.4) (2021-01-09)

**Note:** Version bump only for package @valos/sourcerer





# [0.37.0-alpha.3](https://github.com/valaatech/kernel/compare/v0.37.0-alpha.2...v0.37.0-alpha.3) (2021-01-08)


### Features

* **sourcerer:** Add maxReformAttempts to ProclaimOptions ([a41aa0a](https://github.com/valaatech/kernel/commit/a41aa0aa4aff408d500a4fb213942447d680fa2a))





# [0.37.0-alpha.2](https://github.com/valaatech/kernel/compare/v0.37.0-alpha.1...v0.37.0-alpha.2) (2020-12-14)

**Note:** Version bump only for package @valos/sourcerer





# [0.37.0-alpha.1](https://github.com/valaatech/kernel/compare/v0.37.0-alpha.0...v0.37.0-alpha.1) (2020-12-06)

**Note:** Version bump only for package @valos/sourcerer





# [0.37.0-alpha.0](https://github.com/valaatech/kernel/compare/v0.36.0-alpha.0...v0.37.0-alpha.0) (2020-12-04)


### Features

* Add "chronicles" shared db store. Inc SHARED_DB_VERSION to 2 ([1121a53](https://github.com/valaatech/kernel/commit/1121a5344aae21719d917ed3b267bc13f2430c6e))
* Add terminate to Sourcerers with scribe option for deleting databases ([826fd0f](https://github.com/valaatech/kernel/commit/826fd0f1c41ad76be0b30a0350e71625287ad0d0))





# [0.36.0-alpha.0](https://github.com/valaatech/kernel/compare/v0.35.0...v0.36.0-alpha.0) (2020-11-10)

**Note:** Version bump only for package @valos/sourcerer





# [0.35.0](https://github.com/valaatech/kernel/compare/v0.35.0-rc.36...v0.35.0) (2020-11-08)

**Note:** Version bump only for package @valos/sourcerer





# [0.35.0-rc.36](https://github.com/valaatech/kernel/compare/v0.35.0-rc.35...v0.35.0-rc.36) (2020-11-04)


### Features

* valoscript namespace symbol via $-tagged literals: $`V:name` ([fb2668e](https://github.com/valaatech/kernel/commit/fb2668ea7656269a594250f2836ebe776bfa4879))





# [0.35.0-rc.35](https://github.com/valaatech/kernel/compare/v0.35.0-rc.34...v0.35.0-rc.35) (2020-10-18)

**Note:** Version bump only for package @valos/sourcerer





# [0.35.0-rc.34](https://github.com/valaatech/kernel/compare/v0.35.0-rc.33...v0.35.0-rc.34) (2020-10-13)


### Features

* chainOp ([114e5cb](https://github.com/valaatech/kernel/commit/114e5cbc49d898c42d40fcee0573bc0cb1544021))
* Logging sessions with opLog and opEvent ([fe3f7fb](https://github.com/valaatech/kernel/commit/fe3f7fb0cce902e94dcb3fc81e7fbe943bdbd20f))
* proclaim -> full reform support using event.reformAfterAll ([04ad1dd](https://github.com/valaatech/kernel/commit/04ad1ddd23363eaacaca180585f6769078da6aa2))





# [0.35.0-rc.33](https://github.com/valaatech/kernel/compare/v0.35.0-rc.32...v0.35.0-rc.33) (2020-10-04)


### Bug Fixes

* Ontology revdoc generation issues ([d710690](https://github.com/valaatech/kernel/commit/d7106900d7a0eb4489192375336fede6a8c6df07))


### Features

* Add @valos/log library and the VLog namespace ([0d03ca9](https://github.com/valaatech/kernel/commit/0d03ca921ad42ae478e7936549601e3d42f4dc18))
* Add @valos/space library and move 'V' namespace specification to it ([20b00cd](https://github.com/valaatech/kernel/commit/20b00cd207f73ccfd7a78703480f141c861e7758))
* Add @valos/state library and the VState namespace ([d129897](https://github.com/valaatech/kernel/commit/d129897aa91fe378cc12ffed21baca6b14fab544))
* Add @valos/valk library and the VValk namespace ([97a9090](https://github.com/valaatech/kernel/commit/97a909064030556fafd6a59d67c533365efdca18))
* Add fabricator ProgressEvent events to 'On' namespace ([7705e7c](https://github.com/valaatech/kernel/commit/7705e7c61b768b43e9e99a89633adf8dbe2945da))
* Add On: namespace event handling to Valens ([116e5b6](https://github.com/valaatech/kernel/commit/116e5b6983a4cbbc5741498efa8ba4b6cf13cee9))





# [0.35.0-rc.32](https://github.com/valaatech/kernel/compare/v0.35.0-rc.31...v0.35.0-rc.32) (2020-09-24)

**Note:** Version bump only for package @valos/sourcerer





# [0.35.0-rc.31](https://github.com/valaatech/kernel/compare/v0.35.0-rc.30...v0.35.0-rc.31) (2020-09-23)

**Note:** Version bump only for package @valos/sourcerer





# [0.35.0-rc.30](https://github.com/valaatech/kernel/compare/v0.35.0-rc.29...v0.35.0-rc.30) (2020-09-17)


### Bug Fixes

* VDoc q, c, cell, valma ([e5101df](https://github.com/valaatech/kernel/commit/e5101df882c86e6988c5d8380fd1b1fd3a52480d))


### Features

* Reference tooltips ([0e5790b](https://github.com/valaatech/kernel/commit/0e5790bc4805acd8be94dff2531ee6402e12c30d))





# [0.35.0-rc.29](https://github.com/valaatech/kernel/compare/v0.35.0-rc.28...v0.35.0-rc.29) (2020-08-27)

**Note:** Version bump only for package @valos/sourcerer





# [0.35.0-rc.28](https://github.com/valaatech/kernel/compare/v0.35.0-rc.27...v0.35.0-rc.28) (2020-08-25)

**Note:** Version bump only for package @valos/sourcerer





# [0.35.0-rc.27](https://github.com/valaatech/kernel/compare/v0.35.0-rc.26...v0.35.0-rc.27) (2020-08-24)

**Note:** Version bump only for package @valos/sourcerer





# [0.35.0-rc.26](https://github.com/valaatech/kernel/compare/v0.35.0-rc.25...v0.35.0-rc.26) (2020-08-23)

**Note:** Version bump only for package @valos/sourcerer





# [0.35.0-rc.25](https://github.com/valaatech/kernel/compare/v0.35.0-rc.24...v0.35.0-rc.25) (2020-08-17)


### Bug Fixes

* Multiple chronicle creation in same transaction ([429ce4c](https://github.com/valaatech/kernel/commit/429ce4c8eb8a5359652de570bcc95c572233334a))
* Structured sub-Property id generation from namespaced name ([e81ce9e](https://github.com/valaatech/kernel/commit/e81ce9e269750bf5e6a7370fb126fb0de0fcb218))


### Features

* $V.obtainSubResource ([5567940](https://github.com/valaatech/kernel/commit/5567940559c8807e03efa1d3add83841bacb06da))
* Native 'valaa-memory:' property values ([d5d0521](https://github.com/valaatech/kernel/commit/d5d05218b60c575e582deebaef000653b943dc0a))





# [0.35.0-rc.24](https://github.com/valaatech/kernel/compare/v0.35.0-rc.23...v0.35.0-rc.24) (2020-08-10)

**Note:** Version bump only for package @valos/sourcerer





# [0.35.0-rc.23](https://github.com/valaatech/kernel/compare/v0.35.0-rc.22...v0.35.0-rc.23) (2020-08-04)


### Bug Fixes

* Qualified symbol valoscript loose comparisons ([7a4c5dc](https://github.com/valaatech/kernel/commit/7a4c5dc64aaced61e12762f81fe389ed77eed6bf))


### Features

* $Lens.(offset|limit|sort|reverse|endOffset|elementIndex) ([2f9456c](https://github.com/valaatech/kernel/commit/2f9456cb4b648932fd25f1ec4c343d44569dcccc))
* qualified symbols as "$foo.bar" to valoscript ([568b080](https://github.com/valaatech/kernel/commit/568b08047967bee3b235a2781f3a61c5c0c20261))





# [0.35.0-rc.22](https://github.com/valaatech/kernel/compare/v0.35.0-rc.21...v0.35.0-rc.22) (2020-07-29)

**Note:** Version bump only for package @valos/sourcerer





# [0.35.0-rc.21](https://github.com/valaatech/kernel/compare/v0.35.0-rc.20...v0.35.0-rc.21) (2020-07-20)


### Features

* Add revelation gateway.identity.add section ([06dd1c2](https://github.com/valaatech/kernel/commit/06dd1c2664b50cc0382fd5642995cc72722ebad5))
* Introduce thisChainRedirect - allows chain object return values ([ebb602c](https://github.com/valaatech/kernel/commit/ebb602c0df055a1a852aa2506ccf43a835f2889f))
* valos.describe ([90b1d58](https://github.com/valaatech/kernel/commit/90b1d5893217c9889f2e0637fd03bd17e88cc6dd))





# [0.35.0-rc.20](https://github.com/valaatech/kernel/compare/v0.35.0-rc.19...v0.35.0-rc.20) (2020-06-28)

**Note:** Version bump only for package @valos/sourcerer





# [0.35.0-rc.19](https://github.com/valaatech/kernel/compare/v0.35.0-rc.18...v0.35.0-rc.19) (2020-06-11)

**Note:** Version bump only for package @valos/sourcerer





# [0.35.0-rc.18](https://github.com/valaatech/kernel/compare/v0.35.0-rc.17...v0.35.0-rc.18) (2020-06-10)


### Bug Fixes

* Gateway does not send identity properly ([3ffe05d](https://github.com/valaatech/kernel/commit/3ffe05d2cb99999b687a4358af296c6a468de256))





# [0.35.0-rc.17](https://github.com/valaatech/kernel/compare/v0.35.0-rc.16...v0.35.0-rc.17) (2020-06-03)

**Note:** Version bump only for package @valos/sourcerer





# [0.35.0-rc.16](https://github.com/valaatech/kernel/compare/v0.35.0-rc.15...v0.35.0-rc.16) (2020-05-18)

**Note:** Version bump only for package @valos/sourcerer





# [0.35.0-rc.15](https://github.com/valaatech/kernel/compare/v0.35.0-rc.14...v0.35.0-rc.15) (2020-04-28)

**Note:** Version bump only for package @valos/sourcerer





# [0.35.0-rc.14](https://github.com/valaatech/kernel/compare/v0.35.0-rc.13...v0.35.0-rc.14) (2020-04-27)

**Note:** Version bump only for package @valos/sourcerer





# [0.35.0-rc.13](https://github.com/valaatech/kernel/compare/v0.35.0-rc.12...v0.35.0-rc.13) (2020-04-25)

**Note:** Version bump only for package @valos/sourcerer





# [0.35.0-rc.12](https://github.com/valaatech/kernel/compare/v0.35.0-rc.11...v0.35.0-rc.12) (2020-04-21)


### Features

* VPath JSON sections and outlines ([7ea2a14](https://github.com/valaatech/kernel/commit/7ea2a14c43a6ed0174d42161c66557bd52b6d387))





# [0.35.0-rc.11](https://github.com/valaatech/kernel/compare/v0.35.0-rc.10...v0.35.0-rc.11) (2020-04-09)

**Note:** Version bump only for package @valos/sourcerer





# [0.35.0-rc.10](https://github.com/valaatech/kernel/compare/v0.35.0-rc.9...v0.35.0-rc.10) (2020-04-03)

**Note:** Version bump only for package @valos/sourcerer





# [0.35.0-rc.9](https://github.com/valaatech/kernel/compare/v0.35.0-rc.8...v0.35.0-rc.9) (2020-03-26)


### Bug Fixes

* Missing valma.getVerbosity, export-chronicle vpaths, options.parent ([d40a11d](https://github.com/valaatech/kernel/commit/d40a11d735c0d0a959bfcb7eb05edfe133cfb9c4))





# [0.35.0-rc.8](https://github.com/valaatech/kernel/compare/v0.35.0-rc.7...v0.35.0-rc.8) (2020-03-24)

**Note:** Version bump only for package @valos/sourcerer





# [0.35.0-rc.7](https://github.com/valaatech/kernel/compare/v0.35.0-rc.6...v0.35.0-rc.7) (2020-03-23)


### Bug Fixes

* Missing source location on some errors ([83e9d4d](https://github.com/valaatech/kernel/commit/83e9d4df29be3a996bceb308137bef4a28dfd0fa))





# [0.35.0-rc.6](https://github.com/valaatech/kernel/compare/v0.35.0-rc.5...v0.35.0-rc.6) (2020-03-19)


### Bug Fixes

* flip createChronicleURI and createPartitionURI semantics ([4eff03c](https://github.com/valaatech/kernel/commit/4eff03c96dd01a1052d1e20c1a81bfcafebc44e9))





# [0.35.0-rc.5](https://github.com/valaatech/kernel/compare/v0.35.0-rc.4...v0.35.0-rc.5) (2020-01-29)

**Note:** Version bump only for package @valos/sourcerer





# [0.35.0-rc.4](https://github.com/valaatech/kernel/compare/v0.35.0-rc.3...v0.35.0-rc.4) (2020-01-29)

**Note:** Version bump only for package @valos/sourcerer





# [0.35.0-rc.3](https://github.com/valaatech/kernel/compare/v0.35.0-rc.2...v0.35.0-rc.3) (2020-01-21)

**Note:** Version bump only for package @valos/sourcerer





# [0.35.0-rc.2](https://github.com/valaatech/kernel/compare/v0.35.0-rc.1...v0.35.0-rc.2) (2020-01-15)

**Note:** Version bump only for package @valos/sourcerer





# [0.35.0-rc.1](https://github.com/valaatech/kernel/compare/v0.35.0-rc.0...v0.35.0-rc.1) (2020-01-13)


### Features

* Combine gateway-api/identity with IdentityManager ([8f769b1](https://github.com/valaatech/kernel/commit/8f769b1bc95a97cdbca5b4e6ab7bfd4d5543d331))





# [0.35.0-rc.0](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.23...v0.35.0-rc.0) (2020-01-08)

**Note:** Version bump only for package @valos/sourcerer





# [0.35.0-prerelease.23](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.22...v0.35.0-prerelease.23) (2020-01-06)


### Features

* $V.getSubResource, new Thing({ subResource: "@_:foo@@" }) ([446e726](https://github.com/valaatech/kernel/commit/446e72677c094c4dce7f5490d7e5488f9c791c65))





# [0.35.0-prerelease.22](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.21...v0.35.0-prerelease.22) (2020-01-03)

**Note:** Version bump only for package @valos/sourcerer





# [0.35.0-prerelease.21](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.20...v0.35.0-prerelease.21) (2020-01-01)

**Note:** Version bump only for package @valos/sourcerer





# [0.35.0-prerelease.20](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.19...v0.35.0-prerelease.20) (2019-12-24)


### Features

* Add valos.vrefer, res.$V.vref with inactive reference support ([ec15e9c](https://github.com/valaatech/kernel/commit/ec15e9c8016bb831218bd19b59056662b8c698c6))





# [0.35.0-prerelease.19](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.18...v0.35.0-prerelease.19) (2019-12-18)

**Note:** Version bump only for package @valos/sourcerer





# [0.35.0-prerelease.18](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.17...v0.35.0-prerelease.18) (2019-12-14)


### Features

* Add chronicleURI aliases, Cog.getEngine, fetch, fixes ([464f600](https://github.com/valaatech/kernel/commit/464f6002414a92c8ed76e5ce348ca9356d830cf3))





# [0.35.0-prerelease.17](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.16...v0.35.0-prerelease.17) (2019-12-12)


### Features

* Add Vrapper.getURI, valos.tools .Chronicle, some fixes ([58c3030](https://github.com/valaatech/kernel/commit/58c3030abcdf9cfa132d17db8d8f6fad64c80a7e))
* VPath support for new resource ids ([57dbe6f](https://github.com/valaatech/kernel/commit/57dbe6f00cc26f436393641848572773c71fffaf))





# [0.35.0-prerelease.16](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.15...v0.35.0-prerelease.16) (2019-11-30)

**Note:** Version bump only for package @valos/sourcerer





# [0.35.0-prerelease.15](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.14...v0.35.0-prerelease.15) (2019-11-26)


### Bug Fixes

* nested valk spreaders, vpath object notation ([e712f9a](https://github.com/valaatech/kernel/commit/e712f9a5129f7793ba66ef99199f6683af16cf89))
* revdoc generation for es6 imports ([5db67a6](https://github.com/valaatech/kernel/commit/5db67a64bc3dcbd56e2e78b32cba4c4f70a3676c))





# [0.35.0-prerelease.14](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.13...v0.35.0-prerelease.14) (2019-11-07)


### Bug Fixes

* Minor ontology, perspire --spindle-ids, ([ab1a5e2](https://github.com/valaatech/kernel/commit/ab1a5e2ea0fc4f7834903d638166e958f40b5627))


### Features

* Add valos-raem:Verb and revela ontology ([db80949](https://github.com/valaatech/kernel/commit/db8094973fb0f033a9b375418a334a48aa29e070))
* expressors, impressors and resolvers ([4acb9a3](https://github.com/valaatech/kernel/commit/4acb9a39ea7d0bdf218a25478ae109a3aa231600))
* removed-from ontology ([c61116f](https://github.com/valaatech/kernel/commit/c61116f2e2e768f190fa6f310d3b20e5e2bcc908))





# [0.35.0-prerelease.13](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.12...v0.35.0-prerelease.13) (2019-09-06)

**Note:** Version bump only for package @valos/sourcerer





# [0.35.0-prerelease.12](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.11...v0.35.0-prerelease.12) (2019-09-05)

**Note:** Version bump only for package @valos/sourcerer





# [0.35.0-prerelease.11](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.10...v0.35.0-prerelease.11) (2019-09-03)

**Note:** Version bump only for package @valos/sourcerer





# [0.35.0-prerelease.10](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.9...v0.35.0-prerelease.10) (2019-09-03)


### Features

* Add sourcerer valospace and event aspects ontology drafts ([9603027](https://github.com/valaatech/kernel/commit/9603027))





# [0.35.0-prerelease.9](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.8...v0.35.0-prerelease.9) (2019-08-16)


### Features

* valos:Property hypertwin fields ([c78d5fb](https://github.com/valaatech/kernel/commit/c78d5fb))





# [0.35.0-prerelease.8](https://github.com/valaatech/vault/compare/v0.35.0-prerelease.7...v0.35.0-prerelease.8) (2019-07-24)

**Note:** Version bump only for package @valos/sourcerer





# [0.35.0-prerelease.7](https://github.com/valaatech/vault/compare/v0.35.0-prerelease.6...v0.35.0-prerelease.7) (2019-07-18)

**Note:** Version bump only for package @valos/sourcerer





# [0.35.0-prerelease.6](https://github.com/valaatech/vault/compare/v0.35.0-prerelease.5...v0.35.0-prerelease.6) (2019-07-16)

**Note:** Version bump only for package @valos/sourcerer





# [0.35.0-prerelease.5](https://github.com/valaatech/vault/compare/v0.35.0-prerelease.4...v0.35.0-prerelease.5) (2019-07-14)

**Note:** Version bump only for package @valos/sourcerer





# [0.35.0-prerelease.4](https://github.com/valaatech/vault/compare/v0.35.0-prerelease.3...v0.35.0-prerelease.4) (2019-07-12)

**Note:** Version bump only for package @valos/sourcerer





# [0.35.0-prerelease.3](https://github.com/valaatech/vault/compare/v0.35.0-prerelease.2...v0.35.0-prerelease.3) (2019-07-10)

**Note:** Version bump only for package @valos/sourcerer





# [0.35.0-prerelease.2](https://github.com/valaatech/vault/compare/v0.35.0-prerelease.1...v0.35.0-prerelease.2) (2019-07-01)

**Note:** Version bump only for package @valos/sourcerer





# [0.35.0-prerelease.1](https://github.com/valaatech/vault/compare/v0.35.0-prerelease.0...v0.35.0-prerelease.1) (2019-06-26)

**Note:** Version bump only for package @valos/sourcerer





# [0.35.0-prerelease.0](https://github.com/valaatech/vault/compare/v0.34.0...v0.35.0-prerelease.0) (2019-06-14)

**Note:** Version bump only for package @valos/sourcerer





# [0.34.0](https://github.com/valaatech/vault/compare/v0.34.0-rc.3...v0.34.0) (2019-06-14)

**Note:** Version bump only for package @valos/sourcerer





# [0.34.0-rc.3](https://github.com/valaatech/vault/compare/v0.34.0-rc.2...v0.34.0-rc.3) (2019-06-12)

**Note:** Version bump only for package @valos/sourcerer





# [0.34.0-rc.2](https://github.com/valaatech/vault/compare/v0.34.0-rc.1...v0.34.0-rc.2) (2019-06-10)

**Note:** Version bump only for package @valos/sourcerer





# [0.34.0-rc.1](https://github.com/valaatech/vault/compare/v0.34.0-rc.0...v0.34.0-rc.1) (2019-06-07)


### Bug Fixes

* proper partition command extraction for upgradeEventTo0Dot2 ([09caea3](https://github.com/valaatech/vault/commit/09caea3))





# [0.34.0-rc.0](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.32...v0.34.0-rc.0) (2019-06-03)


### Bug Fixes

* Add check for missing meta/operation ([66d94b6](https://github.com/valaatech/vault/commit/66d94b6))





# [0.34.0-prerelease.32](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.31...v0.34.0-prerelease.32) (2019-06-02)


### Bug Fixes

* Prevent purge with non-schismatic chronicle exceptions ([63cd3b4](https://github.com/valaatech/vault/commit/63cd3b4))





# [0.34.0-prerelease.31](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.30...v0.34.0-prerelease.31) (2019-05-29)

**Note:** Version bump only for package @valos/sourcerer





# [0.34.0-prerelease.30](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.29...v0.34.0-prerelease.30) (2019-05-27)


### Bug Fixes

* **606:** infinite forceUpdate loop with undefined live kuery value ([c8b4da9](https://github.com/valaatech/vault/commit/c8b4da9))





# [0.34.0-prerelease.29](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.28...v0.34.0-prerelease.29) (2019-05-13)

**Note:** Version bump only for package @valos/sourcerer





# [0.34.0-prerelease.28](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.27...v0.34.0-prerelease.28) (2019-05-08)

**Note:** Version bump only for package @valos/sourcerer





# [0.34.0-prerelease.27](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.26...v0.34.0-prerelease.27) (2019-05-08)


### Bug Fixes

* 601, 602 - Desync when refreshing browser while media write to authority not completed ([ba59e88](https://github.com/valaatech/vault/commit/ba59e88))





# [0.34.0-prerelease.26](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.25...v0.34.0-prerelease.26) (2019-05-06)

**Note:** Version bump only for package @valos/sourcerer





# [0.34.0-prerelease.25](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.24...v0.34.0-prerelease.25) (2019-05-04)


### Bug Fixes

* option; inner kueries are now embedded ([b4ffcb4](https://github.com/valaatech/vault/commit/b4ffcb4))





# [0.34.0-prerelease.24](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.23...v0.34.0-prerelease.24) (2019-05-03)

**Note:** Version bump only for package @valos/prophet





# [0.34.0-prerelease.23](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.22...v0.34.0-prerelease.23) (2019-04-30)


### Bug Fixes

* Various fixes and renames ([7eb8456](https://github.com/valaatech/vault/commit/7eb8456))





# [0.34.0-prerelease.22](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.21...v0.34.0-prerelease.22) (2019-04-18)

**Note:** Version bump only for package @valos/prophet





# [0.34.0-prerelease.21](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.20...v0.34.0-prerelease.21) (2019-04-16)


### Bug Fixes

* IdentityManager partition authority bug, adds .get ([048efa1](https://github.com/valaatech/vault/commit/048efa1))





# [0.34.0-prerelease.20](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.19...v0.34.0-prerelease.20) (2019-04-13)


### Bug Fixes

* Merge outputError into enableError via optional second argument ([0255588](https://github.com/valaatech/vault/commit/0255588))
* **593:** Add renarration/rechronicle FalseProphetP*C* semantics ([bf187b5](https://github.com/valaatech/vault/commit/bf187b5))





# [0.34.0-prerelease.19](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.18...v0.34.0-prerelease.19) (2019-04-04)


### Bug Fixes

* "sourceURL", allowActivating, dead code removal, className content ([17a6ddf](https://github.com/valaatech/vault/commit/17a6ddf))
* **592:** Valaa-memory gets stored to cloud ([2400896](https://github.com/valaatech/vault/commit/2400896))





# [0.34.0-prerelease.18](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.17...v0.34.0-prerelease.18) (2019-03-15)


### Bug Fixes

* Don't block event playback for 404 with allowBrokenDownloads ([32df214](https://github.com/valaatech/vault/commit/32df214))





# [0.34.0-prerelease.17](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.16...v0.34.0-prerelease.17) (2019-03-13)


### Bug Fixes

* **prophet:** schism bug with only meta.partitionURI ([f8319e5](https://github.com/valaatech/vault/commit/f8319e5))





# [0.34.0-prerelease.16](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.15...v0.34.0-prerelease.16) (2019-03-11)

**Note:** Version bump only for package @valos/prophet





# [0.34.0-prerelease.15](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.14...v0.34.0-prerelease.15) (2019-03-08)

**Note:** Version bump only for package @valos/prophet





# [0.34.0-prerelease.14](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.13...v0.34.0-prerelease.14) (2019-03-06)


### Bug Fixes

* Conflict revise & merge regression ([5301dac](https://github.com/valaatech/vault/commit/5301dac))
* **588:** Making non-conflicting change while receiving updates causes an error ([5f58015](https://github.com/valaatech/vault/commit/5f58015))





# [0.34.0-prerelease.13](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.12...v0.34.0-prerelease.13) (2019-03-06)


### Bug Fixes

* **585:** Media writing / reading behaves weirdly - as if media cache in memory lags behind ([9019eb0](https://github.com/valaatech/vault/commit/9019eb0))





# [0.34.0-prerelease.12](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.11...v0.34.0-prerelease.12) (2019-03-04)

**Note:** Version bump only for package @valos/prophet





# [0.34.0-prerelease.11](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.10...v0.34.0-prerelease.11) (2019-03-04)

**Note:** Version bump only for package @valos/prophet





# [0.34.0-prerelease.10](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.8...v0.34.0-prerelease.10) (2019-03-03)


### Bug Fixes

* Disable bvob garbage collection deletion temporarily ([2d483e2](https://github.com/valaatech/vault/commit/2d483e2))





# [0.34.0-prerelease.9](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.8...v0.34.0-prerelease.9) (2019-02-28)

**Note:** Version bump only for package @valos/prophet





# [0.34.0-prerelease.8](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.7...v0.34.0-prerelease.8) (2019-02-25)


### Bug Fixes

* **577:** setCommandCountListener doesn't work on gautama ([3162bb9](https://github.com/valaatech/vault/commit/3162bb9))





# [0.34.0-prerelease.7](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.6...v0.34.0-prerelease.7) (2019-02-21)


### Bug Fixes

* Improve vlm.exception and remove es6 code from valma dependencies ([b862b2f](https://github.com/valaatech/vault/commit/b862b2f))





# [0.34.0-prerelease.6](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.5...v0.34.0-prerelease.6) (2019-02-18)


### Bug Fixes

* ValaaScript missing source map issue, other logging ([68a6f01](https://github.com/valaatech/vault/commit/68a6f01))





# [0.34.0-prerelease.5](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.4...v0.34.0-prerelease.5) (2019-02-12)


### Bug Fixes

* Temporary demotes of some exceptions to error messages ([79b0777](https://github.com/valaatech/vault/commit/79b0777))





# [0.34.0-prerelease.4](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.3...v0.34.0-prerelease.4) (2019-02-10)

**Note:** Version bump only for package @valos/prophet





# [0.34.0-prerelease.3](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.2...v0.34.0-prerelease.3) (2019-02-06)


### Bug Fixes

* refresh-no-immediate failure, missing fetch in perspire ([27455b6](https://github.com/valaatech/vault/commit/27455b6))





# [0.34.0-prerelease.2](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.1...v0.34.0-prerelease.2) (2019-02-06)

**Note:** Version bump only for package @valos/prophet





# [0.34.0-prerelease.1](https://github.com/valaatech/vault/compare/v0.33.0...v0.34.0-prerelease.1) (2019-02-06)


### Bug Fixes

* async carryover issue in databaseops ([52728ce](https://github.com/valaatech/vault/commit/52728ce))
* valma logging and pool bugs, text changes, toolset command bugs ([2485d9f](https://github.com/valaatech/vault/commit/2485d9f))





# [0.34.0-prerelease.0](https://github.com/valaatech/vault/compare/v0.33.0...v0.34.0-prerelease.0) (2019-02-03)

**Note:** Version bump only for package @valos/prophet





# [0.33.0](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.13...v0.33.0) (2019-02-01)


### Bug Fixes

* Add missing upgrade path for MODIFIED actions ([3b898ad](https://github.com/valaatech/vault/commit/3b898ad))
* Prevent redundant receiveTruths when options.isTruth is set ([6b20fbe](https://github.com/valaatech/vault/commit/6b20fbe))
* subscribeEvents issue for non-prologue partitions ([7b2fbe8](https://github.com/valaatech/vault/commit/7b2fbe8))





# [0.33.0-prerelease.13](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.12...v0.33.0-prerelease.13) (2019-01-31)

**Note:** Version bump only for package @valos/prophet





# [0.33.0-prerelease.12](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.11...v0.33.0-prerelease.12) (2019-01-30)

**Note:** Version bump only for package @valos/prophet





# [0.33.0-prerelease.11](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.10...v0.33.0-prerelease.11) (2019-01-29)


### Bug Fixes

* OracleP*C* now provides subscribeEvents: true for post-connect narrate ([c5cfe19](https://github.com/valaatech/vault/commit/c5cfe19))





# [0.33.0-prerelease.10](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.9...v0.33.0-prerelease.10) (2019-01-23)


### Bug Fixes

* chronicle media sync race condition with tests ([3b11229](https://github.com/valaatech/vault/commit/3b11229))
* createBvob / Media.content race condition ([023bfaa](https://github.com/valaatech/vault/commit/023bfaa))
* indexeddb validations, PartitionConnect.connect streamlining, others ([5f55c71](https://github.com/valaatech/vault/commit/5f55c71))
* lint ([c7e02d0](https://github.com/valaatech/vault/commit/c7e02d0))
* multiple minor fixes based on external test project ([834f99a](https://github.com/valaatech/vault/commit/834f99a))
* several wrapError issues ([2b32faa](https://github.com/valaatech/vault/commit/2b32faa))
* upstream mediaURL regression ([002a2e0](https://github.com/valaatech/vault/commit/002a2e0))





# [0.33.0-prerelease.9](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.8...v0.33.0-prerelease.9) (2019-01-15)

**Note:** Version bump only for package @valos/prophet





# [0.33.0-prerelease.8](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.7...v0.33.0-prerelease.8) (2019-01-14)


### Bug Fixes

* Delete DESTROYED.typeName when upgrading event from 0.1 to 0.2 ([f1c7c68](https://github.com/valaatech/vault/commit/f1c7c68))
* Renames eventId -> eventRef where VRef is expected ([d4d0d00](https://github.com/valaatech/vault/commit/d4d0d00))
* wrapError clip failure, also context to use console.warn ([889313f](https://github.com/valaatech/vault/commit/889313f))





# [0.33.0-prerelease.7](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.6...v0.33.0-prerelease.7) (2019-01-03)


### Bug Fixes

* Connect sequencing issue with Scribe connections ([f8ca762](https://github.com/valaatech/vault/commit/f8ca762))
* Simplifies transaction nesting logic, fixes uncovered options bug ([9eb3582](https://github.com/valaatech/vault/commit/9eb3582))





# [0.33.0-prerelease.6](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.5...v0.33.0-prerelease.6) (2019-01-02)

**Note:** Version bump only for package @valos/prophet





# [0.33.0-prerelease.5](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.4...v0.33.0-prerelease.5) (2018-12-30)

**Note:** Version bump only for package @valos/prophet





# [0.33.0-prerelease.4](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.3...v0.33.0-prerelease.4) (2018-12-29)

**Note:** Version bump only for package @valos/prophet





# [0.33.0-prerelease.3](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.2...v0.33.0-prerelease.3) (2018-12-18)


### Bug Fixes

* Allow freeze to modify Resource.owner (unless partition root) ([7b26b5c](https://github.com/valaatech/vault/commit/7b26b5c))


### Features

* Add out-of-order cross-partition instantiation & reference support ([2c121a2](https://github.com/valaatech/vault/commit/2c121a2))





# [0.33.0-prerelease.2](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.1...v0.33.0-prerelease.2) (2018-11-22)

**Note:** Version bump only for package @valos/prophet





# [0.33.0-prerelease.1](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.0...v0.33.0-prerelease.1) (2018-11-21)


### Features

* Add event validator version support and version "0.2" skeleton ([82c4a83](https://github.com/valaatech/vault/commit/82c4a83))
* Implement version 0.2 commandId & resourceId creation ([c65c1e6](https://github.com/valaatech/vault/commit/c65c1e6))
* **prophet:** Add EventAspects for managing events across the streams ([6952538](https://github.com/valaatech/vault/commit/6952538))
* **prophet:** Add sequential write queues to Scribe commands and truths ([ee6e18f](https://github.com/valaatech/vault/commit/ee6e18f))
* **prophet:** Implement FalseProphetPartitionConnection event queues ([473e3e2](https://github.com/valaatech/vault/commit/473e3e2))
* **prophet:** Make ChronicleEventResult a concrete type ([becb9d6](https://github.com/valaatech/vault/commit/becb9d6))
* **prophet:** Overhaul and generalize acquirePartitionConnection ([c3c0df1](https://github.com/valaatech/vault/commit/c3c0df1))





<a name="0.33.0-prerelease.0"></a>
# [0.33.0-prerelease.0](https://github.com/valaatech/vault/compare/v0.32.0...v0.33.0-prerelease.0) (2018-09-21)

<a name="0.32.0"></a>
# [0.32.0](https://github.com/valaatech/vault/compare/v0.31.1...v0.32.0) (2018-09-20)


### Bug Fixes

* [#453](https://github.com/valaatech/vault/issues/453) Media content of an instance doesn't change with the prototype ([333c335](https://github.com/valaatech/vault/commit/333c335))
* [#538](https://github.com/valaatech/vault/issues/538) getURL should provide a data object for large size medias when in local/inmemory partition ([4321706](https://github.com/valaatech/vault/commit/4321706))
* [#540](https://github.com/valaatech/vault/issues/540) getUrl provides faulty, mangled Data URLs ([cc45349](https://github.com/valaatech/vault/commit/cc45349))
* Demote connection media validations (at least temporarily) ([493ba3f](https://github.com/valaatech/vault/commit/493ba3f))
* lints, prepareBvob, tests, logging ([71b2ed1](https://github.com/valaatech/vault/commit/71b2ed1))


### Features

* Add MediaInfo contentDisposition etc. and asURL variants ([07e10db](https://github.com/valaatech/vault/commit/07e10db))
* Extract chronicleEventLog from narrateEventLog, changes flags ([828bcd9](https://github.com/valaatech/vault/commit/828bcd9))
