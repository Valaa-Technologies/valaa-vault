# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.37.0-prerelease.1](https://github.com/valaatech/kernel/compare/v0.37.0-prerelease.0...v0.37.0-prerelease.1) (2021-04-14)


### Bug Fixes

* Minor fixes and document updates ([5e836b1](https://github.com/valaatech/kernel/commit/5e836b14bb399bfa47350b4e8274dee7ff6cd00e))
* Reduce naiveURI usage and other minor fixes ([ae1c8da](https://github.com/valaatech/kernel/commit/ae1c8da8900494e76a253db43f5649019f24c615))
* Regression bugs caught by test suite ([f77890a](https://github.com/valaatech/kernel/commit/f77890a972bb74e482bc31431050ac848180d43b))
* Various minor fixes and logging improvements ([ed7866f](https://github.com/valaatech/kernel/commit/ed7866fd7aca7791b71040e089f82f138a84fb2f))


### Features

* Add "meta" section to all spindle prototypes ([3af199e](https://github.com/valaatech/kernel/commit/3af199e66f229dd66e4003868f93dc9789c76370))
* Add (encode|decode)VPlotValue, implement valosp URI conventions ([d9936c9](https://github.com/valaatech/kernel/commit/d9936c9b817b7759690b4fe941a5a9780d4563ae))
* Add error.chainContextName for (this|then)Chain* error handlers ([5958ace](https://github.com/valaatech/kernel/commit/5958acec060f5595ca1f2350c80ad4da3f97e7b4))
* **log:** Rename several V:, VState: and VLog: properties ([61cfa9d](https://github.com/valaatech/kernel/commit/61cfa9d6926e27fb3ca55aff5d982577f1bf5d84))
* **sourcerer:** Replace naiveURI with *.(create|split)ChronicleURI pipeline ([d75a1f2](https://github.com/valaatech/kernel/commit/d75a1f20715f40d9efdf582d703737e498759762))





# [0.37.0-prerelease.0](https://github.com/valaatech/kernel/compare/v0.37.0-alpha.6...v0.37.0-prerelease.0) (2021-02-16)

**Note:** Version bump only for package @valos/raem





# [0.37.0-alpha.6](https://github.com/valaatech/kernel/compare/v0.37.0-alpha.5...v0.37.0-alpha.6) (2021-01-28)

**Note:** Version bump only for package @valos/raem





# [0.37.0-alpha.5](https://github.com/valaatech/kernel/compare/v0.37.0-alpha.4...v0.37.0-alpha.5) (2021-01-18)


### Bug Fixes

* ProphecyOperation swallows unrecoverable errors ([8815fbc](https://github.com/valaatech/kernel/commit/8815fbc2e917ea56d10c28e852ba25091749b7c6))


### Features

* **inspire:** Add stack trace visualizations to VSX attribute errors ([1d453dc](https://github.com/valaatech/kernel/commit/1d453dc1514797dc7b753619a02912f1b1a3e498))
* Add @valos/security library for containing valos security primitives ([338d31d](https://github.com/valaatech/kernel/commit/338d31d4147034233b3dec61c93ee12e583295d7))
* Add INVALIDATED, SEALED event types as reaction to invalid truths ([3826594](https://github.com/valaatech/kernel/commit/38265943315e7f48d879e2e4f2257135dfa17c81))
* Implement 'fixed' resource fields (was known as 'structural') ([948d274](https://github.com/valaatech/kernel/commit/948d27411371025950e10d19f67cf1eb07b1d5e6))
* Seals on a subversive privilege bypass event ([e3008f1](https://github.com/valaatech/kernel/commit/e3008f106ad4e9317ee6c9f1de422a5ef433430a))
* Seals on an impersonating director resource modification ([be34c0d](https://github.com/valaatech/kernel/commit/be34c0d4abcb220896fd3018baaecc75329d5800))





# [0.37.0-alpha.4](https://github.com/valaatech/kernel/compare/v0.37.0-alpha.3...v0.37.0-alpha.4) (2021-01-09)

**Note:** Version bump only for package @valos/raem





# [0.37.0-alpha.3](https://github.com/valaatech/kernel/compare/v0.37.0-alpha.2...v0.37.0-alpha.3) (2021-01-08)

**Note:** Version bump only for package @valos/raem





# [0.37.0-alpha.2](https://github.com/valaatech/kernel/compare/v0.37.0-alpha.1...v0.37.0-alpha.2) (2020-12-14)

**Note:** Version bump only for package @valos/raem





# [0.37.0-alpha.1](https://github.com/valaatech/kernel/compare/v0.37.0-alpha.0...v0.37.0-alpha.1) (2020-12-06)

**Note:** Version bump only for package @valos/raem





# [0.37.0-alpha.0](https://github.com/valaatech/kernel/compare/v0.36.0-alpha.0...v0.37.0-alpha.0) (2020-12-04)

**Note:** Version bump only for package @valos/raem





# [0.36.0-alpha.0](https://github.com/valaatech/kernel/compare/v0.35.0...v0.36.0-alpha.0) (2020-11-10)

**Note:** Version bump only for package @valos/raem





# [0.35.0](https://github.com/valaatech/kernel/compare/v0.35.0-rc.36...v0.35.0) (2020-11-08)

**Note:** Version bump only for package @valos/raem





# [0.35.0-rc.36](https://github.com/valaatech/kernel/compare/v0.35.0-rc.35...v0.35.0-rc.36) (2020-11-04)


### Bug Fixes

* Relax non-empty requirement from various MODIFIED fields ([131cf9e](https://github.com/valaatech/kernel/commit/131cf9eccf7c98145c9a78cc515f911b723337aa))


### Features

* valoscript namespace symbol via $-tagged literals: $`V:name` ([fb2668e](https://github.com/valaatech/kernel/commit/fb2668ea7656269a594250f2836ebe776bfa4879))





# [0.35.0-rc.35](https://github.com/valaatech/kernel/compare/v0.35.0-rc.34...v0.35.0-rc.35) (2020-10-18)


### Bug Fixes

* hasInterface not working properly for destroyed resources ([9e163ed](https://github.com/valaatech/kernel/commit/9e163ed0d1b4401ac78eb3d8facd2ba3dd0dcf4f))





# [0.35.0-rc.34](https://github.com/valaatech/kernel/compare/v0.35.0-rc.33...v0.35.0-rc.34) (2020-10-13)

**Note:** Version bump only for package @valos/raem





# [0.35.0-rc.33](https://github.com/valaatech/kernel/compare/v0.35.0-rc.32...v0.35.0-rc.33) (2020-10-04)


### Bug Fixes

* Ontology revdoc generation issues ([d710690](https://github.com/valaatech/kernel/commit/d7106900d7a0eb4489192375336fede6a8c6df07))


### Features

* Add @valos/log library and the VLog namespace ([0d03ca9](https://github.com/valaatech/kernel/commit/0d03ca921ad42ae478e7936549601e3d42f4dc18))
* Add @valos/space library and move 'V' namespace specification to it ([20b00cd](https://github.com/valaatech/kernel/commit/20b00cd207f73ccfd7a78703480f141c861e7758))
* Add @valos/state library and the VState namespace ([d129897](https://github.com/valaatech/kernel/commit/d129897aa91fe378cc12ffed21baca6b14fab544))
* Add @valos/valk library and the VValk namespace ([97a9090](https://github.com/valaatech/kernel/commit/97a909064030556fafd6a59d67c533365efdca18))





# [0.35.0-rc.32](https://github.com/valaatech/kernel/compare/v0.35.0-rc.31...v0.35.0-rc.32) (2020-09-24)

**Note:** Version bump only for package @valos/raem





# [0.35.0-rc.31](https://github.com/valaatech/kernel/compare/v0.35.0-rc.30...v0.35.0-rc.31) (2020-09-23)

**Note:** Version bump only for package @valos/raem





# [0.35.0-rc.30](https://github.com/valaatech/kernel/compare/v0.35.0-rc.29...v0.35.0-rc.30) (2020-09-17)


### Bug Fixes

* VDoc q, c, cell, valma ([e5101df](https://github.com/valaatech/kernel/commit/e5101df882c86e6988c5d8380fd1b1fd3a52480d))


### Features

* Reference tooltips ([0e5790b](https://github.com/valaatech/kernel/commit/0e5790bc4805acd8be94dff2531ee6402e12c30d))
* VRevdoc:Tooltip, VDoc:elidable, indexLabel, deprecatedInFavorOf ([b126296](https://github.com/valaatech/kernel/commit/b126296562562470dd1f4779f43b08c9f34482a2))





# [0.35.0-rc.29](https://github.com/valaatech/kernel/compare/v0.35.0-rc.28...v0.35.0-rc.29) (2020-08-27)

**Note:** Version bump only for package @valos/raem





# [0.35.0-rc.28](https://github.com/valaatech/kernel/compare/v0.35.0-rc.27...v0.35.0-rc.28) (2020-08-25)

**Note:** Version bump only for package @valos/raem





# [0.35.0-rc.27](https://github.com/valaatech/kernel/compare/v0.35.0-rc.26...v0.35.0-rc.27) (2020-08-24)


### Features

* Add deprecation support for namespace symbols and Lenses in specific ([dc48e56](https://github.com/valaatech/kernel/commit/dc48e562f1df7f3714ed935b6d575e7fb1f11879))





# [0.35.0-rc.26](https://github.com/valaatech/kernel/compare/v0.35.0-rc.25...v0.35.0-rc.26) (2020-08-23)

**Note:** Version bump only for package @valos/raem





# [0.35.0-rc.25](https://github.com/valaatech/kernel/compare/v0.35.0-rc.24...v0.35.0-rc.25) (2020-08-17)


### Bug Fixes

* Structured sub-Property id generation from namespaced name ([e81ce9e](https://github.com/valaatech/kernel/commit/e81ce9e269750bf5e6a7370fb126fb0de0fcb218))


### Features

* $V.obtainSubResource ([5567940](https://github.com/valaatech/kernel/commit/5567940559c8807e03efa1d3add83841bacb06da))
* Native 'valaa-memory:' property values ([d5d0521](https://github.com/valaatech/kernel/commit/d5d05218b60c575e582deebaef000653b943dc0a))





# [0.35.0-rc.24](https://github.com/valaatech/kernel/compare/v0.35.0-rc.23...v0.35.0-rc.24) (2020-08-10)

**Note:** Version bump only for package @valos/raem





# [0.35.0-rc.23](https://github.com/valaatech/kernel/compare/v0.35.0-rc.22...v0.35.0-rc.23) (2020-08-04)


### Bug Fixes

* Qualified symbol valoscript loose comparisons ([7a4c5dc](https://github.com/valaatech/kernel/commit/7a4c5dc64aaced61e12762f81fe389ed77eed6bf))


### Features

* $Lens.(offset|limit|sort|reverse|endOffset|elementIndex) ([2f9456c](https://github.com/valaatech/kernel/commit/2f9456cb4b648932fd25f1ec4c343d44569dcccc))
* qualified symbols as "$foo.bar" to valoscript ([568b080](https://github.com/valaatech/kernel/commit/568b08047967bee3b235a2781f3a61c5c0c20261))





# [0.35.0-rc.22](https://github.com/valaatech/kernel/compare/v0.35.0-rc.21...v0.35.0-rc.22) (2020-07-29)

**Note:** Version bump only for package @valos/raem





# [0.35.0-rc.21](https://github.com/valaatech/kernel/compare/v0.35.0-rc.20...v0.35.0-rc.21) (2020-07-20)

**Note:** Version bump only for package @valos/raem





# [0.35.0-rc.20](https://github.com/valaatech/kernel/compare/v0.35.0-rc.19...v0.35.0-rc.20) (2020-06-28)

**Note:** Version bump only for package @valos/raem





# [0.35.0-rc.19](https://github.com/valaatech/kernel/compare/v0.35.0-rc.18...v0.35.0-rc.19) (2020-06-11)

**Note:** Version bump only for package @valos/raem





# [0.35.0-rc.18](https://github.com/valaatech/kernel/compare/v0.35.0-rc.17...v0.35.0-rc.18) (2020-06-10)

**Note:** Version bump only for package @valos/raem





# [0.35.0-rc.17](https://github.com/valaatech/kernel/compare/v0.35.0-rc.16...v0.35.0-rc.17) (2020-06-03)

**Note:** Version bump only for package @valos/raem





# [0.35.0-rc.16](https://github.com/valaatech/kernel/compare/v0.35.0-rc.15...v0.35.0-rc.16) (2020-05-18)

**Note:** Version bump only for package @valos/raem





# [0.35.0-rc.15](https://github.com/valaatech/kernel/compare/v0.35.0-rc.14...v0.35.0-rc.15) (2020-04-28)

**Note:** Version bump only for package @valos/raem





# [0.35.0-rc.14](https://github.com/valaatech/kernel/compare/v0.35.0-rc.13...v0.35.0-rc.14) (2020-04-27)


### Bug Fixes

* various minor bugs ([3cfe81a](https://github.com/valaatech/kernel/commit/3cfe81a21898c023d4316fc784f2f27298869d7c))





# [0.35.0-rc.13](https://github.com/valaatech/kernel/compare/v0.35.0-rc.12...v0.35.0-rc.13) (2020-04-25)

**Note:** Version bump only for package @valos/raem





# [0.35.0-rc.12](https://github.com/valaatech/kernel/compare/v0.35.0-rc.11...v0.35.0-rc.12) (2020-04-21)


### Features

* VPath JSON sections and outlines ([7ea2a14](https://github.com/valaatech/kernel/commit/7ea2a14c43a6ed0174d42161c66557bd52b6d387))





# [0.35.0-rc.11](https://github.com/valaatech/kernel/compare/v0.35.0-rc.10...v0.35.0-rc.11) (2020-04-09)

**Note:** Version bump only for package @valos/raem





# [0.35.0-rc.10](https://github.com/valaatech/kernel/compare/v0.35.0-rc.9...v0.35.0-rc.10) (2020-04-03)

**Note:** Version bump only for package @valos/raem





# [0.35.0-rc.9](https://github.com/valaatech/kernel/compare/v0.35.0-rc.8...v0.35.0-rc.9) (2020-03-26)

**Note:** Version bump only for package @valos/raem





# [0.35.0-rc.8](https://github.com/valaatech/kernel/compare/v0.35.0-rc.7...v0.35.0-rc.8) (2020-03-24)

**Note:** Version bump only for package @valos/raem





# [0.35.0-rc.7](https://github.com/valaatech/kernel/compare/v0.35.0-rc.6...v0.35.0-rc.7) (2020-03-23)


### Bug Fixes

* Missing source location on some errors ([83e9d4d](https://github.com/valaatech/kernel/commit/83e9d4df29be3a996bceb308137bef4a28dfd0fa))





# [0.35.0-rc.6](https://github.com/valaatech/kernel/compare/v0.35.0-rc.5...v0.35.0-rc.6) (2020-03-19)


### Bug Fixes

* flip createChronicleURI and createPartitionURI semantics ([4eff03c](https://github.com/valaatech/kernel/commit/4eff03c96dd01a1052d1e20c1a81bfcafebc44e9))





# [0.35.0-rc.5](https://github.com/valaatech/kernel/compare/v0.35.0-rc.4...v0.35.0-rc.5) (2020-01-29)

**Note:** Version bump only for package @valos/raem





# [0.35.0-rc.4](https://github.com/valaatech/kernel/compare/v0.35.0-rc.3...v0.35.0-rc.4) (2020-01-29)

**Note:** Version bump only for package @valos/raem





# [0.35.0-rc.3](https://github.com/valaatech/kernel/compare/v0.35.0-rc.2...v0.35.0-rc.3) (2020-01-21)

**Note:** Version bump only for package @valos/raem





# [0.35.0-rc.2](https://github.com/valaatech/kernel/compare/v0.35.0-rc.1...v0.35.0-rc.2) (2020-01-15)

**Note:** Version bump only for package @valos/raem





# [0.35.0-rc.1](https://github.com/valaatech/kernel/compare/v0.35.0-rc.0...v0.35.0-rc.1) (2020-01-13)

**Note:** Version bump only for package @valos/raem





# [0.35.0-rc.0](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.23...v0.35.0-rc.0) (2020-01-08)


### Bug Fixes

* [#619](https://github.com/valaatech/kernel/issues/619) Null values in array Properties return a Vrapper ([b19ff2e](https://github.com/valaatech/kernel/commit/b19ff2e45476bc5784632a0872aa3aee48edfacd))





# [0.35.0-prerelease.23](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.22...v0.35.0-prerelease.23) (2020-01-06)


### Features

* $V.getSubResource, new Thing({ subResource: "@_:foo@@" }) ([446e726](https://github.com/valaatech/kernel/commit/446e72677c094c4dce7f5490d7e5488f9c791c65))





# [0.35.0-prerelease.22](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.21...v0.35.0-prerelease.22) (2020-01-03)

**Note:** Version bump only for package @valos/raem





# [0.35.0-prerelease.21](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.20...v0.35.0-prerelease.21) (2020-01-01)

**Note:** Version bump only for package @valos/raem





# [0.35.0-prerelease.20](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.19...v0.35.0-prerelease.20) (2019-12-24)


### Features

* Add valos.vrefer, res.$V.vref with inactive reference support ([ec15e9c](https://github.com/valaatech/kernel/commit/ec15e9c8016bb831218bd19b59056662b8c698c6))





# [0.35.0-prerelease.19](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.18...v0.35.0-prerelease.19) (2019-12-18)


### Features

* **rest-api-spindle:** Parallelize live preloads ([2e2107b](https://github.com/valaatech/kernel/commit/2e2107b4326e52c3ccbe38d45775930b23e34b68))





# [0.35.0-prerelease.18](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.17...v0.35.0-prerelease.18) (2019-12-14)


### Features

* Add chronicleURI aliases, Cog.getEngine, fetch, fixes ([464f600](https://github.com/valaatech/kernel/commit/464f6002414a92c8ed76e5ce348ca9356d830cf3))





# [0.35.0-prerelease.17](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.16...v0.35.0-prerelease.17) (2019-12-12)


### Features

* Add Vrapper.getURI, valos.tools .Chronicle, some fixes ([58c3030](https://github.com/valaatech/kernel/commit/58c3030abcdf9cfa132d17db8d8f6fad64c80a7e))
* VPath support for new resource ids ([57dbe6f](https://github.com/valaatech/kernel/commit/57dbe6f00cc26f436393641848572773c71fffaf))





# [0.35.0-prerelease.16](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.15...v0.35.0-prerelease.16) (2019-11-30)


### Bug Fixes

* gateway container rootId -> viewRootId, others ([ae57c30](https://github.com/valaatech/kernel/commit/ae57c3095900fc441fb1217c2a9ace8224cb4923))





# [0.35.0-prerelease.15](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.14...v0.35.0-prerelease.15) (2019-11-26)


### Bug Fixes

* All 4 rest API GET routes ([e416e14](https://github.com/valaatech/kernel/commit/e416e14a5eb3a9a2031f895ef1ef358bb03f4edc))
* attach fastify routes immediately after preparation ([d43f1b5](https://github.com/valaatech/kernel/commit/d43f1b54ff972f7d1d0252ac31c5c4e56f24a0ff))
* nested valk spreaders, vpath object notation ([e712f9a](https://github.com/valaatech/kernel/commit/e712f9a5129f7793ba66ef99199f6683af16cf89))
* revdoc generation for es6 imports ([5db67a6](https://github.com/valaatech/kernel/commit/5db67a64bc3dcbd56e2e78b32cba4c4f70a3676c))





# [0.35.0-prerelease.14](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.13...v0.35.0-prerelease.14) (2019-11-07)


### Bug Fixes

* Minor ontology, perspire --spindle-ids, ([ab1a5e2](https://github.com/valaatech/kernel/commit/ab1a5e2ea0fc4f7834903d638166e958f40b5627))


### Features

* Add bindExpandedVPath contextState for callback state ([0893fb2](https://github.com/valaatech/kernel/commit/0893fb2248b4f4060ae5a795c36909599fdd896a))
* Add object and sequence support to VPath binding ([c7d5873](https://github.com/valaatech/kernel/commit/c7d58733db05ec8dbdaf210d889bed44d215c7e0))
* Add schema-builder routes, projections and site config testdoc chapter ([39a4528](https://github.com/valaatech/kernel/commit/39a452847fef94b1d79839c08237fd75549acb0a))
* Add valos-raem:Verb and revela ontology ([db80949](https://github.com/valaatech/kernel/commit/db8094973fb0f033a9b375418a334a48aa29e070))
* Add VPath minting and validator functions ([9a2e86a](https://github.com/valaatech/kernel/commit/9a2e86a6007243e231dfe6638a55ca92a3374e76))
* expressors, impressors and resolvers ([4acb9a3](https://github.com/valaatech/kernel/commit/4acb9a39ea7d0bdf218a25478ae109a3aa231600))
* Implement VPath expanded form helpers ([5aec6da](https://github.com/valaatech/kernel/commit/5aec6da0a56c5eef2b28343c427d4ddd218a90a7))
* removed-from ontology ([c61116f](https://github.com/valaatech/kernel/commit/c61116f2e2e768f190fa6f310d3b20e5e2bcc908))





# [0.35.0-prerelease.13](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.12...v0.35.0-prerelease.13) (2019-09-06)

**Note:** Version bump only for package @valos/raem





# [0.35.0-prerelease.12](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.11...v0.35.0-prerelease.12) (2019-09-05)

**Note:** Version bump only for package @valos/raem





# [0.35.0-prerelease.11](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.10...v0.35.0-prerelease.11) (2019-09-03)

**Note:** Version bump only for package @valos/raem





# [0.35.0-prerelease.10](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.9...v0.35.0-prerelease.10) (2019-09-03)

**Note:** Version bump only for package @valos/raem





# [0.35.0-prerelease.9](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.8...v0.35.0-prerelease.9) (2019-08-16)

**Note:** Version bump only for package @valos/raem





# [0.35.0-prerelease.8](https://github.com/valaatech/vault/compare/v0.35.0-prerelease.7...v0.35.0-prerelease.8) (2019-07-24)

**Note:** Version bump only for package @valos/raem





# [0.35.0-prerelease.7](https://github.com/valaatech/vault/compare/v0.35.0-prerelease.6...v0.35.0-prerelease.7) (2019-07-18)

**Note:** Version bump only for package @valos/raem





# [0.35.0-prerelease.6](https://github.com/valaatech/vault/compare/v0.35.0-prerelease.5...v0.35.0-prerelease.6) (2019-07-16)

**Note:** Version bump only for package @valos/raem





# [0.35.0-prerelease.5](https://github.com/valaatech/vault/compare/v0.35.0-prerelease.4...v0.35.0-prerelease.5) (2019-07-14)

**Note:** Version bump only for package @valos/raem





# [0.35.0-prerelease.4](https://github.com/valaatech/vault/compare/v0.35.0-prerelease.3...v0.35.0-prerelease.4) (2019-07-12)

**Note:** Version bump only for package @valos/raem





# [0.35.0-prerelease.3](https://github.com/valaatech/vault/compare/v0.35.0-prerelease.2...v0.35.0-prerelease.3) (2019-07-10)

**Note:** Version bump only for package @valos/raem





# [0.35.0-prerelease.2](https://github.com/valaatech/vault/compare/v0.35.0-prerelease.1...v0.35.0-prerelease.2) (2019-07-01)

**Note:** Version bump only for package @valos/raem





# [0.35.0-prerelease.1](https://github.com/valaatech/vault/compare/v0.35.0-prerelease.0...v0.35.0-prerelease.1) (2019-06-26)

**Note:** Version bump only for package @valos/raem





# [0.35.0-prerelease.0](https://github.com/valaatech/vault/compare/v0.34.0...v0.35.0-prerelease.0) (2019-06-14)

**Note:** Version bump only for package @valos/raem





# [0.34.0](https://github.com/valaatech/vault/compare/v0.34.0-rc.3...v0.34.0) (2019-06-14)

**Note:** Version bump only for package @valos/raem





# [0.34.0-rc.3](https://github.com/valaatech/vault/compare/v0.34.0-rc.2...v0.34.0-rc.3) (2019-06-12)

**Note:** Version bump only for package @valos/raem





# [0.34.0-rc.2](https://github.com/valaatech/vault/compare/v0.34.0-rc.1...v0.34.0-rc.2) (2019-06-10)

**Note:** Version bump only for package @valos/raem





# [0.34.0-rc.1](https://github.com/valaatech/vault/compare/v0.34.0-rc.0...v0.34.0-rc.1) (2019-06-07)


### Bug Fixes

* proper partition command extraction for upgradeEventTo0Dot2 ([09caea3](https://github.com/valaatech/vault/commit/09caea3))





# [0.34.0-rc.0](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.32...v0.34.0-rc.0) (2019-06-03)

**Note:** Version bump only for package @valos/raem





# [0.34.0-prerelease.32](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.31...v0.34.0-prerelease.32) (2019-06-02)

**Note:** Version bump only for package @valos/raem





# [0.34.0-prerelease.31](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.30...v0.34.0-prerelease.31) (2019-05-29)

**Note:** Version bump only for package @valos/raem





# [0.34.0-prerelease.30](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.29...v0.34.0-prerelease.30) (2019-05-27)


### Bug Fixes

* **606:** infinite forceUpdate loop with undefined live kuery value ([c8b4da9](https://github.com/valaatech/vault/commit/c8b4da9))





# [0.34.0-prerelease.29](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.28...v0.34.0-prerelease.29) (2019-05-13)


### Bug Fixes

* Prevent .vs functions from being live ([2e76df5](https://github.com/valaatech/vault/commit/2e76df5))





# [0.34.0-prerelease.28](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.27...v0.34.0-prerelease.28) (2019-05-08)

**Note:** Version bump only for package @valos/raem





# [0.34.0-prerelease.27](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.26...v0.34.0-prerelease.27) (2019-05-08)

**Note:** Version bump only for package @valos/raem





# [0.34.0-prerelease.26](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.25...v0.34.0-prerelease.26) (2019-05-06)

**Note:** Version bump only for package @valos/raem





# [0.34.0-prerelease.25](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.24...v0.34.0-prerelease.25) (2019-05-04)

**Note:** Version bump only for package @valos/raem





# [0.34.0-prerelease.24](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.23...v0.34.0-prerelease.24) (2019-05-03)

**Note:** Version bump only for package @valos/raem





# [0.34.0-prerelease.23](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.22...v0.34.0-prerelease.23) (2019-04-30)

**Note:** Version bump only for package @valos/raem





# [0.34.0-prerelease.22](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.21...v0.34.0-prerelease.22) (2019-04-18)


### Bug Fixes

* broken vs/vsx error traces ([f385944](https://github.com/valaatech/vault/commit/f385944))





# [0.34.0-prerelease.21](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.20...v0.34.0-prerelease.21) (2019-04-16)

**Note:** Version bump only for package @valos/raem





# [0.34.0-prerelease.20](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.19...v0.34.0-prerelease.20) (2019-04-13)


### Bug Fixes

* Merge outputError into enableError via optional second argument ([0255588](https://github.com/valaatech/vault/commit/0255588))





# [0.34.0-prerelease.19](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.18...v0.34.0-prerelease.19) (2019-04-04)


### Bug Fixes

* "sourceURL", allowActivating, dead code removal, className content ([17a6ddf](https://github.com/valaatech/vault/commit/17a6ddf))
* **592:** Valaa-memory gets stored to cloud ([2400896](https://github.com/valaatech/vault/commit/2400896))





# [0.34.0-prerelease.18](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.17...v0.34.0-prerelease.18) (2019-03-15)

**Note:** Version bump only for package @valos/raem





# [0.34.0-prerelease.17](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.16...v0.34.0-prerelease.17) (2019-03-13)


### Bug Fixes

* InactiveResource issue with unordered partition load ([d115bcf](https://github.com/valaatech/vault/commit/d115bcf))





# [0.34.0-prerelease.16](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.15...v0.34.0-prerelease.16) (2019-03-11)

**Note:** Version bump only for package @valos/raem





# [0.34.0-prerelease.15](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.14...v0.34.0-prerelease.15) (2019-03-08)

**Note:** Version bump only for package @valos/raem





# [0.34.0-prerelease.14](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.13...v0.34.0-prerelease.14) (2019-03-06)


### Bug Fixes

* Conflict revise & merge regression ([5301dac](https://github.com/valaatech/vault/commit/5301dac))





# [0.34.0-prerelease.13](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.12...v0.34.0-prerelease.13) (2019-03-06)

**Note:** Version bump only for package @valos/raem





# [0.34.0-prerelease.12](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.11...v0.34.0-prerelease.12) (2019-03-04)

**Note:** Version bump only for package @valos/raem





# [0.34.0-prerelease.11](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.10...v0.34.0-prerelease.11) (2019-03-04)

**Note:** Version bump only for package @valos/raem





# [0.34.0-prerelease.10](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.8...v0.34.0-prerelease.10) (2019-03-03)


### Bug Fixes

* **toolset-vault:** allow-unchanged -> add-unchanged ([b1dd624](https://github.com/valaatech/vault/commit/b1dd624))
* Disable bvob garbage collection deletion temporarily ([2d483e2](https://github.com/valaatech/vault/commit/2d483e2))





# [0.34.0-prerelease.9](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.8...v0.34.0-prerelease.9) (2019-02-28)


### Bug Fixes

* **toolset-vault:** allow-unchanged -> add-unchanged ([b1dd624](https://github.com/valaatech/vault/commit/b1dd624))





# [0.34.0-prerelease.8](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.7...v0.34.0-prerelease.8) (2019-02-25)


### Bug Fixes

* **579:** Wrong error message ("Downloading") when VSX parse fails ([0424167](https://github.com/valaatech/vault/commit/0424167))





# [0.34.0-prerelease.7](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.6...v0.34.0-prerelease.7) (2019-02-21)


### Bug Fixes

* Improve vlm.exception and remove es6 code from valma dependencies ([b862b2f](https://github.com/valaatech/vault/commit/b862b2f))
* lint errors ([73e9e3f](https://github.com/valaatech/vault/commit/73e9e3f))





# [0.34.0-prerelease.6](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.5...v0.34.0-prerelease.6) (2019-02-18)


### Bug Fixes

* ValaaScript missing source map issue, other logging ([68a6f01](https://github.com/valaatech/vault/commit/68a6f01))





# [0.34.0-prerelease.5](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.4...v0.34.0-prerelease.5) (2019-02-12)


### Bug Fixes

* Temporary demotes of some exceptions to error messages ([79b0777](https://github.com/valaatech/vault/commit/79b0777))





# [0.34.0-prerelease.4](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.3...v0.34.0-prerelease.4) (2019-02-10)

**Note:** Version bump only for package @valos/raem





# [0.34.0-prerelease.3](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.2...v0.34.0-prerelease.3) (2019-02-06)

**Note:** Version bump only for package @valos/raem





# [0.34.0-prerelease.2](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.1...v0.34.0-prerelease.2) (2019-02-06)

**Note:** Version bump only for package @valos/raem





# [0.34.0-prerelease.1](https://github.com/valaatech/vault/compare/v0.33.0...v0.34.0-prerelease.1) (2019-02-06)


### Bug Fixes

* valma logging and pool bugs, text changes, toolset command bugs ([2485d9f](https://github.com/valaatech/vault/commit/2485d9f))





# [0.34.0-prerelease.0](https://github.com/valaatech/vault/compare/v0.33.0...v0.34.0-prerelease.0) (2019-02-03)

**Note:** Version bump only for package @valos/raem





# [0.33.0](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.13...v0.33.0) (2019-02-01)


### Bug Fixes

* ghostHost incorrectly returned truthy values for non-ghosts ([d5b5ae4](https://github.com/valaatech/vault/commit/d5b5ae4))





# [0.33.0-prerelease.13](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.12...v0.33.0-prerelease.13) (2019-01-31)


### Bug Fixes

* Media Lens regression. ([f7d685b](https://github.com/valaatech/vault/commit/f7d685b))





# [0.33.0-prerelease.12](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.11...v0.33.0-prerelease.12) (2019-01-30)

**Note:** Version bump only for package @valos/raem





# [0.33.0-prerelease.11](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.10...v0.33.0-prerelease.11) (2019-01-29)

**Note:** Version bump only for package @valos/raem





# [0.33.0-prerelease.10](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.9...v0.33.0-prerelease.10) (2019-01-23)


### Bug Fixes

* and test for $V.partitionURI regression ([08c9bf3](https://github.com/valaatech/vault/commit/08c9bf3))
* indeterminable coupling for inactive resources ([c9e2cf2](https://github.com/valaatech/vault/commit/c9e2cf2))
* lint ([c7e02d0](https://github.com/valaatech/vault/commit/c7e02d0))
* multiple minor fixes based on external test project ([834f99a](https://github.com/valaatech/vault/commit/834f99a))
* several wrapError issues ([2b32faa](https://github.com/valaatech/vault/commit/2b32faa))





# [0.33.0-prerelease.9](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.8...v0.33.0-prerelease.9) (2019-01-15)


### Bug Fixes

* Don't use spread operator with 'options' objects ([5b90d10](https://github.com/valaatech/vault/commit/5b90d10))





# [0.33.0-prerelease.8](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.7...v0.33.0-prerelease.8) (2019-01-14)


### Bug Fixes

* ref.inactive issues, with transient merging specifically ([7d7e257](https://github.com/valaatech/vault/commit/7d7e257))
* wrapError clip failure, also context to use console.warn ([889313f](https://github.com/valaatech/vault/commit/889313f))





# [0.33.0-prerelease.7](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.6...v0.33.0-prerelease.7) (2019-01-03)


### Bug Fixes

* Connect sequencing issue with Scribe connections ([f8ca762](https://github.com/valaatech/vault/commit/f8ca762))
* Simplifies transaction nesting logic, fixes uncovered options bug ([9eb3582](https://github.com/valaatech/vault/commit/9eb3582))





# [0.33.0-prerelease.6](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.5...v0.33.0-prerelease.6) (2019-01-02)

**Note:** Version bump only for package @valos/raem





# [0.33.0-prerelease.5](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.4...v0.33.0-prerelease.5) (2018-12-30)

**Note:** Version bump only for package @valos/raem





# [0.33.0-prerelease.4](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.3...v0.33.0-prerelease.4) (2018-12-29)

**Note:** Version bump only for package @valos/raem





# [0.33.0-prerelease.3](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.2...v0.33.0-prerelease.3) (2018-12-18)


### Bug Fixes

* Allow freeze to modify Resource.owner (unless partition root) ([7b26b5c](https://github.com/valaatech/vault/commit/7b26b5c))


### Features

* Add out-of-order cross-partition instantiation & reference support ([2c121a2](https://github.com/valaatech/vault/commit/2c121a2))
* Introduce ContentAPI.inactiveType as the API-specific inactive type ([6476c7a](https://github.com/valaatech/vault/commit/6476c7a))





# [0.33.0-prerelease.2](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.1...v0.33.0-prerelease.2) (2018-11-22)

**Note:** Version bump only for package @valos/raem





# [0.33.0-prerelease.1](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.0...v0.33.0-prerelease.1) (2018-11-21)


### Features

* **prophet:** Make ChronicleEventResult a concrete type ([becb9d6](https://github.com/valaatech/vault/commit/becb9d6))
* Add event validator version support and version "0.2" skeleton ([82c4a83](https://github.com/valaatech/vault/commit/82c4a83))





<a name="0.33.0-prerelease.0"></a>
# [0.33.0-prerelease.0](https://github.com/valaatech/vault/compare/v0.32.0...v0.33.0-prerelease.0) (2018-09-21)

<a name="0.32.0"></a>
# [0.32.0](https://github.com/valaatech/vault/compare/v0.31.1...v0.32.0) (2018-09-20)


### Bug Fixes

* [#453](https://github.com/valaatech/vault/issues/453) Media content of an instance doesn't change with the prototype ([333c335](https://github.com/valaatech/vault/commit/333c335))
* [#499](https://github.com/valaatech/vault/issues/499) Setting a Media's Blob to be a Blob on another partition causes failure ([ec7f0a4](https://github.com/valaatech/vault/commit/ec7f0a4))
* lints, prepareBvob, tests, logging ([71b2ed1](https://github.com/valaatech/vault/commit/71b2ed1))
