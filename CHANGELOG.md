# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.37.0-prerelease.1](https://github.com/valaatech/kernel/compare/v0.37.0-prerelease.0...v0.37.0-prerelease.1) (2021-04-14)


### Bug Fixes

* Improve error context logging, especially with (this|then)ChainEagerly ([f24cdec](https://github.com/valaatech/kernel/commit/f24cdecf320b3a30a61dae240f373402abbcf01a))
* Lint errors ([8aa1b12](https://github.com/valaatech/kernel/commit/8aa1b12eca33966bc902328050835fbfc2064227))
* Minor fixes and document updates ([5e836b1](https://github.com/valaatech/kernel/commit/5e836b14bb399bfa47350b4e8274dee7ff6cd00e))
* Reduce naiveURI usage and other minor fixes ([ae1c8da](https://github.com/valaatech/kernel/commit/ae1c8da8900494e76a253db43f5649019f24c615))
* Regression bugs caught by test suite ([f77890a](https://github.com/valaatech/kernel/commit/f77890a972bb74e482bc31431050ac848180d43b))
* Various minor fixes and logging improvements ([ed7866f](https://github.com/valaatech/kernel/commit/ed7866fd7aca7791b71040e089f82f138a84fb2f))
* **log:** Fix fourth "inception" log test ([b6f88fa](https://github.com/valaatech/kernel/commit/b6f88fa3523fd2a59074a51ff539b9f4ea41e50b))
* **log:** Instantiation test according the new log spec ([4974bc1](https://github.com/valaatech/kernel/commit/4974bc1d4ce000f5a742707de6b10d86084a74da))
* **sourcerer:** Perform revisioning on profess errors ([6cae75a](https://github.com/valaatech/kernel/commit/6cae75afe27055ad09a23d300b5a4310aa1469d8))


### Features

* **authority-spindle:** Add full init flow with the revdoc setup guide ([6555579](https://github.com/valaatech/kernel/commit/6555579541905cfac1a0600bffa314064872ee6b))
* Add "meta" section to all spindle prototypes ([3af199e](https://github.com/valaatech/kernel/commit/3af199e66f229dd66e4003868f93dc9789c76370))
* **authority-spindle:** Add "headers" support for all projectors ([b213783](https://github.com/valaatech/kernel/commit/b213783831902578411f7f24848e7e4399084e5f))
* **authority-spindle:** Add authority-worker test suite ([6aa50cf](https://github.com/valaatech/kernel/commit/6aa50cfcf227c5de45edfd50a5fd696fcbbfa150))
* **authority-spindle:** Add bvob projector implementation base ([b97be63](https://github.com/valaatech/kernel/commit/b97be638e851661144cfee1897f4f316f9fd614f))
* **authority-spindle:** Complete unauthenticated, nonauthored paths ([6766884](https://github.com/valaatech/kernel/commit/67668849c8f79509abf9230788ae4e0023b23c5d))
* **authority-spindle:** Complete valosp PUT and GET event routes ([e2ff108](https://github.com/valaatech/kernel/commit/e2ff1085b36a58dd1985e8e5c5a8642aa2269e14))
* **authority-spindle:** Determine chronicleURI with configured authorityURI ([87e35c5](https://github.com/valaatech/kernel/commit/87e35c5b1a604a878b269a489d1ac72ff8493e28))
* **authority-spindle:** Export "event/log" projector skeletons for web spindle ([75cbffe](https://github.com/valaatech/kernel/commit/75cbffe51c3e917a14a0b220649d23e4fb9eaa1e))
* **authority-spindle:** Implement ranges for (get|post)LogEvents ([a57b08a](https://github.com/valaatech/kernel/commit/a57b08adf23bc44c9f24c4663b7e682f18b7a14f))
* **authority-spindle:** Initial skeleton for ValOS authority web route projectors spindle ([61c492f](https://github.com/valaatech/kernel/commit/61c492f0cea0407034fd64696de1ed8b52c09918))
* **inspire:** Allow both "module.exports =" and "export default" for spindles ([ef8d0aa](https://github.com/valaatech/kernel/commit/ef8d0aa4ac3b7dd01010c2c40ec2b410939ddeb1))
* **inspire:** Allow null rootChronicleURI and foci for non-browser contexts ([ef07a78](https://github.com/valaatech/kernel/commit/ef07a783f82faf1032fcf0ea1e8886a7f6573cdb))
* **log:** Add resource origins and logical images to main test ([b52dc66](https://github.com/valaatech/kernel/commit/b52dc6693b7f3278d8d4db331168f9c0674cb55b))
* **log:** Add vlog revdoc.test with create, reference and ghost examples ([b9b03ef](https://github.com/valaatech/kernel/commit/b9b03ef93eb854916fa53e61aac29d8c3b7652c9))
* **log:** Implement fifth test "removal" (preliminary) ([47ddde5](https://github.com/valaatech/kernel/commit/47ddde5e28cda4edce362def89477f5aa074b6ab))
* **log:** Rename several V:, VState: and VLog: properties ([61cfa9d](https://github.com/valaatech/kernel/commit/61cfa9d6926e27fb3ca55aff5d982577f1bf5d84))
* **revdoc:** Add VRevdoc:RegExp and VRevdoc:regexp ([7ed3516](https://github.com/valaatech/kernel/commit/7ed351691e9d46f491f31d53308702fafdb5f640))
* **sourcerer:** Add Connection.getActiveAuthority for delayed authorities ([11e97e0](https://github.com/valaatech/kernel/commit/11e97e063b80e75f898da06cbeafa9d9a18d1d00))
* **sourcerer:** Add log.timeStamp when authorizing a valosp command as truth ([814253c](https://github.com/valaatech/kernel/commit/814253cc3eac90cd18dafa2f385bedd0415d09aa))
* **sourcerer:** Add Sourcerer..createChronicleRootID ([0f734bd](https://github.com/valaatech/kernel/commit/0f734bd145be49d771d14c9653a07a2115a0f571))
* **valma:** Add execute(..., { paramPrefix }) (with "--" as default) ([7b725cd](https://github.com/valaatech/kernel/commit/7b725cddc78d4d322e1cddf9adc8868761c21624))
* **web-spindle:** Add all methods "static" projectors ([b01bfbb](https://github.com/valaatech/kernel/commit/b01bfbb43e441dbf8c1534fc99c90aa76cb63be5))
* **web-spindle:** Add configure --ssl option ([822536c](https://github.com/valaatech/kernel/commit/822536c73f0a6b6ddf745e4229f74e368cb4faa7))
* Add (encode|decode)VPlotValue, implement valosp URI conventions ([d9936c9](https://github.com/valaatech/kernel/commit/d9936c9b817b7759690b4fe941a5a9780d4563ae))
* Add error.chainContextName for (this|then)Chain* error handlers ([5958ace](https://github.com/valaatech/kernel/commit/5958acec060f5595ca1f2350c80ad4da3f97e7b4))
* Add hash40FromHexSHA512 as bvob hash fallback ([1285206](https://github.com/valaatech/kernel/commit/12852061e0a951ae2b92a43ef56872aacf6a3bbd))
* Implement valosp bvob pathway as POST multipart/form-data file ([4a6d5ac](https://github.com/valaatech/kernel/commit/4a6d5ac8e9304c27de94917976b54301e1f6e8cc))
* **sourcerer:** Implement valosp bvob operations ([3f6e963](https://github.com/valaatech/kernel/commit/3f6e96321ae95c8a16b46800fcb6c9138aacfd4a))
* **sourcerer:** Initial valosp scheme Authority/Connection implementation ([bcde424](https://github.com/valaatech/kernel/commit/bcde424d4af7a2339efd7ceafef8924480644007))
* **sourcerer:** Replace naiveURI with *.(create|split)ChronicleURI pipeline ([d75a1f2](https://github.com/valaatech/kernel/commit/d75a1f20715f40d9efdf582d703737e498759762))
* **testaur:** Add test authority worker ([f0e63e2](https://github.com/valaatech/kernel/commit/f0e63e2e97fcc7441703b53d9c3fb45aae3ce810))
* **web-spindle:** Add "static" projector ([9404316](https://github.com/valaatech/kernel/commit/94043161da1f8f30594ee521663c3e754a6be00c))
* **web-spindle:** Expose route params as default rules ([436b1e3](https://github.com/valaatech/kernel/commit/436b1e315034ce3c7f3858ac2e2a36c34e127e69))
* **web-spindle:** Import projectors from other spindles ([5058816](https://github.com/valaatech/kernel/commit/5058816891c6772e6c0bd1bbef132b93f27b644f))





# [0.37.0-prerelease.0](https://github.com/valaatech/kernel/compare/v0.37.0-alpha.6...v0.37.0-prerelease.0) (2021-02-16)


### Bug Fixes

* **valma:** Don't bump version if updating preid to a greater one ([f5e7de5](https://github.com/valaatech/kernel/commit/f5e7de58097bd5aa37c74f0edd89131964021509))
* Premature setAbsent(false) ([ea252a6](https://github.com/valaatech/kernel/commit/ea252a6add166c9be620f88b052158e6b2d747e5))


### Features

* **gateway-api:** Add authorizeSession.identityProviderURI for openid servers ([60adfff](https://github.com/valaatech/kernel/commit/60adfffad09daa935cf05aeaccb0399a5f7fcc15))
* **inspire:** Add valos.attachView, some fixes ([78ebb81](https://github.com/valaatech/kernel/commit/78ebb81fbe408e9966d08cd9c12d74421fd21bb6))
* **security:** Add valos.hash40, the base64url encoded SHA256/240 ([d27cd7c](https://github.com/valaatech/kernel/commit/d27cd7c224d753923b0c4fd30e02dd609a38b678))
* **valma:** Add vlm.fetch and vlm.fetchJSON ([92f86df](https://github.com/valaatech/kernel/commit/92f86df5d4501c4f82be83c60e5c68c67209e573))
* **vlm:** Add vlm.chapter and vlm.table ([6c20ab6](https://github.com/valaatech/kernel/commit/6c20ab65681160cc87cd756927c1e7bb16a88fc7))





# [0.37.0-alpha.6](https://github.com/valaatech/kernel/compare/v0.37.0-alpha.5...v0.37.0-alpha.6) (2021-01-28)


### Features

* **inspire:** Add isFullscreen view option, deprecates "isView", "isRoot" ([220d844](https://github.com/valaatech/kernel/commit/220d8445fc5e4498072da147aeff50c29181f455))
* **inspire:** Add valos.initialize, valos.createView and prologue.root ([0fa03bc](https://github.com/valaatech/kernel/commit/0fa03bceb322ed30d49d63241c5eb3288e376e8a))
* **sourcerer:** IdentityMediator API simplification ([457f685](https://github.com/valaatech/kernel/commit/457f68599e0af36abd64bbcfe1fd7bc4f91c1069))





# [0.37.0-alpha.5](https://github.com/valaatech/kernel/compare/v0.37.0-alpha.4...v0.37.0-alpha.5) (2021-01-18)


### Bug Fixes

* Documentation require issues, missing index links ([9ed7831](https://github.com/valaatech/kernel/commit/9ed7831498b42b73bac9c0ec052490cb10e4f5ba))
* Extraneous vplot outline suffix VPlot serialization as a hack ([07b91bd](https://github.com/valaatech/kernel/commit/07b91bdd0319856ca3e2c67656dfe8e10dec4089))
* ProphecyOperation swallows unrecoverable errors ([8815fbc](https://github.com/valaatech/kernel/commit/8815fbc2e917ea56d10c28e852ba25091749b7c6))
* Universalization 'undefined' leak, missing INVALIDATED command.id ([5c0f220](https://github.com/valaatech/kernel/commit/5c0f2205fb2c5b9b1cb3cb7c3882279ee7768c22))
* Various minor bugs ([c47ec68](https://github.com/valaatech/kernel/commit/c47ec6882f5d9dffcce3922896d904b644a097a5))
* **inspire:** Trivial On:click handlers do not translate as onClick ([61803ef](https://github.com/valaatech/kernel/commit/61803ef346ee53f6a422920d455e9bfb5f11a647))


### Features

* **inspire:** Add stack trace visualizations to VSX attribute errors ([1d453dc](https://github.com/valaatech/kernel/commit/1d453dc1514797dc7b753619a02912f1b1a3e498))
* **inspire:** Set lens "this" to be originating Media ([cbcd415](https://github.com/valaatech/kernel/commit/cbcd4156b90554aa6f581e05ac53b7d59e579dbc))
* Add @valos/chronicle library and the 'VChronicle' namespace ([549d400](https://github.com/valaatech/kernel/commit/549d400ea3c561b6421abac2cb60e55864c7a9fd))
* Add @valos/security library for containing valos security primitives ([338d31d](https://github.com/valaatech/kernel/commit/338d31d4147034233b3dec61c93ee12e583295d7))
* Add AuthorAspect and use tweetnacl for signing events ([6022c18](https://github.com/valaatech/kernel/commit/6022c18531286ed2511c3bb5b8aab88ec00ed747))
* Add INVALIDATED, SEALED event types as reaction to invalid truths ([3826594](https://github.com/valaatech/kernel/commit/38265943315e7f48d879e2e4f2257135dfa17c81))
* Add preliminary 1 happy and 7 sad chronicle behaviors tests ([7e8f7e1](https://github.com/valaatech/kernel/commit/7e8f7e1e6a053e79fe2cf83ab43d462d23030d45))
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


### Bug Fixes

* **699:** Chronicle activation does not cause live trigger? ([b900df2](https://github.com/valaatech/kernel/commit/b900df2b1783af8bda898150e0dc4d030b763272))
* **702:** Instance lens does not work as the only element in VSX ([acf1595](https://github.com/valaatech/kernel/commit/acf1595e9cdb6bb2bf7d03a9dd47b4b3cb2cec64))





# [0.37.0-alpha.3](https://github.com/valaatech/kernel/compare/v0.37.0-alpha.2...v0.37.0-alpha.3) (2021-01-08)


### Bug Fixes

* **#698:** Inline-including context.this.something causes context.this to be wonky ([4aecc88](https://github.com/valaatech/kernel/commit/4aecc88496e2de2642440a363ff92cf68601b49a)), closes [#698](https://github.com/valaatech/kernel/issues/698)
* Revert generic attribute function wrapping back to selective ones ([bde4fb2](https://github.com/valaatech/kernel/commit/bde4fb27b8a5401df4d63c9f4fd3b0d76604ab07))


### Features

* **valma:** Add update*Config (path, update, { flush: true }) option ([192e122](https://github.com/valaatech/kernel/commit/192e122232a885e15e146930938fede775290c92))
* individualOf for revelation templates ([0dd723e](https://github.com/valaatech/kernel/commit/0dd723e67f9f2254d79a597370ec6631f9eda7b3))
* **sourcerer:** Add maxReformAttempts to ProclaimOptions ([a41aa0a](https://github.com/valaatech/kernel/commit/a41aa0aa4aff408d500a4fb213942447d680fa2a))





# [0.37.0-alpha.2](https://github.com/valaatech/kernel/compare/v0.37.0-alpha.1...v0.37.0-alpha.2) (2020-12-14)


### Bug Fixes

* Builtin Valens attribute with function value is not wrapped properly ([ef2ff8c](https://github.com/valaatech/kernel/commit/ef2ff8c23ef572c75f60a93d6cb7dae06966d514))
* InaactiveResource verb-type mapping from "@?" to "@I" ([93c4c44](https://github.com/valaatech/kernel/commit/93c4c44cfdffa0dcb085a6872ae75380e9666cba))
* Make release-vault --develop default to "alpha" ([d496f84](https://github.com/valaatech/kernel/commit/d496f84a37835e80567996f4d01fa1c6821d068f))


### Features

* Add @valos/type-type, vlm.getFileConfig and other workflow fixes ([68b5d3d](https://github.com/valaatech/kernel/commit/68b5d3d10bd60973a2c9dbdb78db936d1c1fb748))





# [0.37.0-alpha.1](https://github.com/valaatech/kernel/compare/v0.37.0-alpha.0...v0.37.0-alpha.1) (2020-12-06)


### Features

* Add assemble-packages --bump lerna forward ([fc01f15](https://github.com/valaatech/kernel/commit/fc01f15e0df983950fe21155670d28d7a9d4c473))





# [0.37.0-alpha.0](https://github.com/valaatech/kernel/compare/v0.36.0-alpha.0...v0.37.0-alpha.0) (2020-12-04)


### Features

* Add "chronicles" shared db store. Inc SHARED_DB_VERSION to 2 ([1121a53](https://github.com/valaatech/kernel/commit/1121a5344aae21719d917ed3b267bc13f2430c6e))
* Add inspect and postpone options to invoke/execute retry handler ([c3a15bd](https://github.com/valaatech/kernel/commit/c3a15bd1c6b7aad816148844501e58f83c411040))
* Add terminate to Sourcerers with scribe option for deleting databases ([826fd0f](https://github.com/valaatech/kernel/commit/826fd0f1c41ad76be0b30a0350e71625287ad0d0))





# [0.36.0-alpha.0](https://github.com/valaatech/kernel/compare/v0.35.0...v0.36.0-alpha.0) (2020-11-10)


### Features

* Version control workflow: stable, edge, release/*, develop/* ([99ad165](https://github.com/valaatech/kernel/commit/99ad1657907e2dc04530860efe7dcb5a88b8aba2))





# [0.35.0](https://github.com/valaatech/kernel/compare/v0.35.0-rc.36...v0.35.0) (2020-11-08)


### Bug Fixes

* Vrapper#hasInterface issue with destroyed/non-created resources ([fafeb2d](https://github.com/valaatech/kernel/commit/fafeb2dd57309e0474983967b61ee98463720c02))





# [0.35.0-rc.36](https://github.com/valaatech/kernel/compare/v0.35.0-rc.35...v0.35.0-rc.36) (2020-11-04)


### Bug Fixes

* "entities" and "relations" do not live update on resource creation ([38c6a65](https://github.com/valaatech/kernel/commit/38c6a65aad22edbfac0f6e2fe83d7c41bdc5a107))
* $V.getFickleId() didnt start immediately after '.' ([3d4d3fe](https://github.com/valaatech/kernel/commit/3d4d3fe6f8a680186ccde043bf78f476df7842ca))
* Relax non-empty requirement from various MODIFIED fields ([131cf9e](https://github.com/valaatech/kernel/commit/131cf9eccf7c98145c9a78cc515f911b723337aa))


### Features

* valoscript namespace symbol via $-tagged literals: $`V:name` ([fb2668e](https://github.com/valaatech/kernel/commit/fb2668ea7656269a594250f2836ebe776bfa4879))





# [0.35.0-rc.35](https://github.com/valaatech/kernel/compare/v0.35.0-rc.34...v0.35.0-rc.35) (2020-10-18)


### Bug Fixes

* <Valoscope array> issues with non-triggering of Valens-handling ([cf58797](https://github.com/valaatech/kernel/commit/cf5879737ace38d8c920e4c63b918a15fb45ff3d))
* hasInterface not working properly for destroyed resources ([9e163ed](https://github.com/valaatech/kernel/commit/9e163ed0d1b4401ac78eb3d8facd2ba3dd0dcf4f))
* Revert thoughtless removal of the deprecated $V.prepareBlob ([5cb2d79](https://github.com/valaatech/kernel/commit/5cb2d79984d25ba9c77d1151707fba2eba9afa64))


### Features

* resource.$V.getFickleId(minimumLength = 4) ([bc54425](https://github.com/valaatech/kernel/commit/bc54425dac957b7400fe0fcfe287b8037fec26eb))





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
* Add @valos/plot library and the VPlot namespace ([1c003ad](https://github.com/valaatech/kernel/commit/1c003adaf45c11a163d53c99d0a4f21cc797efd1))
* Add @valos/space library and move 'V' namespace specification to it ([20b00cd](https://github.com/valaatech/kernel/commit/20b00cd207f73ccfd7a78703480f141c861e7758))
* Add @valos/state library and the VState namespace ([d129897](https://github.com/valaatech/kernel/commit/d129897aa91fe378cc12ffed21baca6b14fab544))
* Add @valos/valk library and the VValk namespace ([97a9090](https://github.com/valaatech/kernel/commit/97a909064030556fafd6a59d67c533365efdca18))
* Add fabricator ProgressEvent events to 'On' namespace ([7705e7c](https://github.com/valaatech/kernel/commit/7705e7c61b768b43e9e99a89633adf8dbe2945da))
* Add On: namespace event handling to Valens ([116e5b6](https://github.com/valaatech/kernel/commit/116e5b6983a4cbbc5741498efa8ba4b6cf13cee9))
* **type-library:** Add specify-namespace tool ([2234c3e](https://github.com/valaatech/kernel/commit/2234c3e76d4f2fbe6354f0ba46835cffeef33ea8))





# [0.35.0-rc.32](https://github.com/valaatech/kernel/compare/v0.35.0-rc.31...v0.35.0-rc.32) (2020-09-24)


### Features

* **revdoc:** inv6n shortcut, VDoc:lines, make prompt non-selectable ([e62e357](https://github.com/valaatech/kernel/commit/e62e357c9481edf492c2e72eaf9b45f1a429a03a))





# [0.35.0-rc.31](https://github.com/valaatech/kernel/compare/v0.35.0-rc.30...v0.35.0-rc.31) (2020-09-23)


### Bug Fixes

* Add missing @valos/revdoc dependencies ([aef4072](https://github.com/valaatech/kernel/commit/aef40725d53072d49cc8a4df21d19e5c26da90e9))
* Re-add tooltip summary.css ([0d1e453](https://github.com/valaatech/kernel/commit/0d1e453b803fa78cf010a767b99f4b6b1df08133))


### Features

* **web-spindle:** options.httpsRedirectPort a html 301 to https redirection ([6472e3f](https://github.com/valaatech/kernel/commit/6472e3f1449475558302e5feecc4f78dba2b18ab))





# [0.35.0-rc.30](https://github.com/valaatech/kernel/compare/v0.35.0-rc.29...v0.35.0-rc.30) (2020-09-17)


### Bug Fixes

* VDoc q, c, cell, valma ([e5101df](https://github.com/valaatech/kernel/commit/e5101df882c86e6988c5d8380fd1b1fd3a52480d))


### Features

* Add "Lens" and "On" namespaces ([0be9e08](https://github.com/valaatech/kernel/commit/0be9e081c10e8b08923cf74c44e83a93331d13fc))
* Reference tooltips ([0e5790b](https://github.com/valaatech/kernel/commit/0e5790bc4805acd8be94dff2531ee6402e12c30d))
* VRevdoc:Tooltip, VDoc:elidable, indexLabel, deprecatedInFavorOf ([b126296](https://github.com/valaatech/kernel/commit/b126296562562470dd1f4779f43b08c9f34482a2))
* VRevdoc:VSX ([f8a4a60](https://github.com/valaatech/kernel/commit/f8a4a60717625ebe8b8e063a6d578eeb491bded3))
* **vdoc:** VDoc:map, VDoc:heading, [@context](https://github.com/context) extraction, qualified refs ([4d7c8cf](https://github.com/valaatech/kernel/commit/4d7c8cf5e75595330bb9f370964300bad6ce2583))





# [0.35.0-rc.29](https://github.com/valaatech/kernel/compare/v0.35.0-rc.28...v0.35.0-rc.29) (2020-08-27)


### Bug Fixes

* Add revealer peer dependency, revelationRoot for file routes ([26ed0e6](https://github.com/valaatech/kernel/commit/26ed0e6dae41130ef26389922c2cbffe0dcaed90))





# [0.35.0-rc.28](https://github.com/valaatech/kernel/compare/v0.35.0-rc.27...v0.35.0-rc.28) (2020-08-25)

**Note:** Version bump only for package @valos/kernel-vault





# [0.35.0-rc.27](https://github.com/valaatech/kernel/compare/v0.35.0-rc.26...v0.35.0-rc.27) (2020-08-24)


### Features

* Add deprecation support for namespace symbols and Lenses in specific ([dc48e56](https://github.com/valaatech/kernel/commit/dc48e562f1df7f3714ed935b6d575e7fb1f11879))
* revelation.spindles auto-valosRequire if not attached yet ([1139744](https://github.com/valaatech/kernel/commit/11397447dd8b5f30c0bae2c230d1372859ae14ae))





# [0.35.0-rc.26](https://github.com/valaatech/kernel/compare/v0.35.0-rc.25...v0.35.0-rc.26) (2020-08-23)


### Features

* $Lens.delayed for incremental UI component loading ([f2eda2b](https://github.com/valaatech/kernel/commit/f2eda2b3e6f397622f5029729beab884be421121))
* Lens.static and 'static-' namespace prefix for non-live attributes ([1ce8d63](https://github.com/valaatech/kernel/commit/1ce8d63f15689fecf2a14900853b1b26cbc00b5a))





# [0.35.0-rc.25](https://github.com/valaatech/kernel/compare/v0.35.0-rc.24...v0.35.0-rc.25) (2020-08-17)


### Bug Fixes

* a Vrapper activation sequencing issue ([d28e4ae](https://github.com/valaatech/kernel/commit/d28e4ae76e6579711aab5c0ae35f82d3c5bd97ff))
* Multiple chronicle creation in same transaction ([429ce4c](https://github.com/valaatech/kernel/commit/429ce4c8eb8a5359652de570bcc95c572233334a))
* Structured sub-Property id generation from namespaced name ([e81ce9e](https://github.com/valaatech/kernel/commit/e81ce9e269750bf5e6a7370fb126fb0de0fcb218))
* **653:** Multi-chronicle operations leave some commands stuck in command queue ([0af00fa](https://github.com/valaatech/kernel/commit/0af00fadabedcdf726adbfa453ec2058f44d48a0))


### Features

* $V.obtainSubResource ([5567940](https://github.com/valaatech/kernel/commit/5567940559c8807e03efa1d3add83841bacb06da))
* Native 'valaa-memory:' property values ([d5d0521](https://github.com/valaatech/kernel/commit/d5d05218b60c575e582deebaef000653b943dc0a))
* top-level 'require' access to spindle..valospaceRequirables ([833c971](https://github.com/valaatech/kernel/commit/833c9710fb15b81ab8410a260ef5c58422fa539d))





# [0.35.0-rc.24](https://github.com/valaatech/kernel/compare/v0.35.0-rc.23...v0.35.0-rc.24) (2020-08-10)

**Note:** Version bump only for package @valos/kernel-vault





# [0.35.0-rc.23](https://github.com/valaatech/kernel/compare/v0.35.0-rc.22...v0.35.0-rc.23) (2020-08-04)


### Bug Fixes

* Qualified symbol valoscript loose comparisons ([7a4c5dc](https://github.com/valaatech/kernel/commit/7a4c5dc64aaced61e12762f81fe389ed77eed6bf))
* **682:** Better error message for creating Resource without owner ([9b134de](https://github.com/valaatech/kernel/commit/9b134de7ddf75b503a7d48ad7e36b9ac531c11c7))
* **683:** Line breaks don't get properly added... ([0dd086a](https://github.com/valaatech/kernel/commit/0dd086a18f0d5848356d9438ea7d36b82919a8ff))
* **687:** Then-lens fails on firts load and VSX change ([c2b03b7](https://github.com/valaatech/kernel/commit/c2b03b77f402af039023624c926afbb972f484cb))
* **688:** If-lens fails in some conditions ([d8e56f4](https://github.com/valaatech/kernel/commit/d8e56f43cd46cde01c09d592df5f48373b8adf25))
* **689:** Recursive instance lenses fail to get assigned properties ([85306ca](https://github.com/valaatech/kernel/commit/85306ca2f8a42389f11ab78950e3c7f055ff0315))


### Features

* $Lens.(offset|limit|sort|reverse|endOffset|elementIndex) ([2f9456c](https://github.com/valaatech/kernel/commit/2f9456cb4b648932fd25f1ec4c343d44569dcccc))
* qualified symbols as "$foo.bar" to valoscript ([568b080](https://github.com/valaatech/kernel/commit/568b08047967bee3b235a2781f3a61c5c0c20261))





# [0.35.0-rc.22](https://github.com/valaatech/kernel/compare/v0.35.0-rc.21...v0.35.0-rc.22) (2020-07-29)


### Bug Fixes

* vsx decoding issues ([8e939b9](https://github.com/valaatech/kernel/commit/8e939b9421708e0a755d158d4a0640e2d3252921))


### Features

* Add 'this' keyword for lens medias for referencing the Media itself ([110b3b2](https://github.com/valaatech/kernel/commit/110b3b289854c872602597b68167b03f42059556))
* Add simplified Vrapper..updateProperties for resource creation ([e641775](https://github.com/valaatech/kernel/commit/e641775422415936a13f427336476af631cdad25))
* Formalize Lens.key with clean (if not so simple) semantics ([96d10f7](https://github.com/valaatech/kernel/commit/96d10f7341e0b8aad824075250eea178dae0383e))





# [0.35.0-rc.21](https://github.com/valaatech/kernel/compare/v0.35.0-rc.20...v0.35.0-rc.21) (2020-07-20)


### Features

* Add "live." and "static." vsx attribute namespace prefix options ([7ecf361](https://github.com/valaatech/kernel/commit/7ecf36153167d07cf689e62ba4af9fb732039c3f))
* Add "reuse" support to repeathenable lens kueries ([5eded21](https://github.com/valaatech/kernel/commit/5eded21844653e27e5be6612aa370c05e5eb6ac1))
* Add Lens.integrationScopeResource ([2884d93](https://github.com/valaatech/kernel/commit/2884d935760560459470117599deae1c3cca2089))
* Add revelation gateway.identity.add section ([06dd1c2](https://github.com/valaatech/kernel/commit/06dd1c2664b50cc0382fd5642995cc72722ebad5))
* frame override valoscope parameters ([6d23935](https://github.com/valaatech/kernel/commit/6d23935591d60f2c04f21bcdb747773fd602d5bf))
* Introduce thisChainRedirect - allows chain object return values ([ebb602c](https://github.com/valaatech/kernel/commit/ebb602c0df055a1a852aa2506ccf43a835f2889f))
* Lens.if/then/else ([66c0048](https://github.com/valaatech/kernel/commit/66c0048d1c2ac94a3fc98110cae31c2bd06b0167))
* valos.describe ([90b1d58](https://github.com/valaatech/kernel/commit/90b1d5893217c9889f2e0637fd03bd17e88cc6dd))





# [0.35.0-rc.20](https://github.com/valaatech/kernel/compare/v0.35.0-rc.19...v0.35.0-rc.20) (2020-06-28)


### Bug Fixes

* Make vlm --no-force-broken the default ([4f7924b](https://github.com/valaatech/kernel/commit/4f7924bfd5330293a8174fe03a05805925929e06))
* Return grandparent scopes to getLexicalScope ([de09ba7](https://github.com/valaatech/kernel/commit/de09ba798b84992118a1c39edc991420f0fb3d91))
* **662:** Quoted out content in VSX throws exception when in an empty element ([8dc2fc2](https://github.com/valaatech/kernel/commit/8dc2fc2c4ae37873978e8521b65719dff7e359c4))
* **663:** Faulty error message when mistyping a function in namespace ([c5f0302](https://github.com/valaatech/kernel/commit/c5f0302dbac0ed0c7bd4b9ef0edd5d0d1be7919f))
* **674:** Better error message for empty media ([ef87dde](https://github.com/valaatech/kernel/commit/ef87ddec515e938429408fcddfeb180728b808dc))


### Features

* Add default workspace name type suffix suggestion: -{type} ([bf95570](https://github.com/valaatech/kernel/commit/bf95570b2e07672d39b009b7c1d096e8d11ee654))
* Add property-based media interpretation scoping ([2f470ba](https://github.com/valaatech/kernel/commit/2f470bacc6cb5ce20889c43021c44f6d85151e5d))
* Namespaced vsx element properties ([c0c7497](https://github.com/valaatech/kernel/commit/c0c749740623363ba499b14732bf134d961ef64c))





# [0.35.0-rc.19](https://github.com/valaatech/kernel/compare/v0.35.0-rc.18...v0.35.0-rc.19) (2020-06-11)


### Bug Fixes

* Ignore valma from babel, add logging to vlm tool/set selectors ([ff00866](https://github.com/valaatech/kernel/commit/ff008666041ac322f10285d78ca607bf2ee14ebc))





# [0.35.0-rc.18](https://github.com/valaatech/kernel/compare/v0.35.0-rc.17...v0.35.0-rc.18) (2020-06-10)


### Bug Fixes

* Gateway does not send identity properly ([3ffe05d](https://github.com/valaatech/kernel/commit/3ffe05d2cb99999b687a4358af296c6a468de256))


### Features

* Add 'tool' type and a type-library toolset ([88e50ad](https://github.com/valaatech/kernel/commit/88e50ad2544f143506ddf1e7ebc6fcd0aad9e172))
* Add "vlm craft-tool", use it to create "copy-template-files" ([8048f50](https://github.com/valaatech/kernel/commit/8048f50ec7ebb8985abe46a186b8828cbe3985f8))
* Add valma failure retry base functionality ([636deb4](https://github.com/valaatech/kernel/commit/636deb444a24f47d85aa8a6ac4d679133e9c765e))
* add vlm.updateFileConifg ([e600711](https://github.com/valaatech/kernel/commit/e600711a4ff2db65b472f6ea687df2598af0915b))





# [0.35.0-rc.17](https://github.com/valaatech/kernel/compare/v0.35.0-rc.16...v0.35.0-rc.17) (2020-06-03)


### Bug Fixes

* gitignore "node_modules" -> "node_modules/" ([e38589c](https://github.com/valaatech/kernel/commit/e38589cce9dab4e1879953a28a812cfc48b9b896))


### Features

* Add opspaces, workers yarn workspaces ([1234815](https://github.com/valaatech/kernel/commit/1234815e5564c0abaedc85d81e1e37604075a3a6))
* Major tool/set reorganization into new @valos/type-toolset ([6cf12d0](https://github.com/valaatech/kernel/commit/6cf12d039ead5ac19dc818edce0832446f51b7c3))
* Streamline 'vlm init' /w type, domain and toolset choice descriptions ([8add032](https://github.com/valaatech/kernel/commit/8add03216091e43efae6cdcc043fb6cec327cc66))
* **valma:** Add support for nested state flags ([a17e67b](https://github.com/valaatech/kernel/commit/a17e67ba9e30abf825e692c55f60ba425c70959f))





# [0.35.0-rc.16](https://github.com/valaatech/kernel/compare/v0.35.0-rc.15...v0.35.0-rc.16) (2020-05-18)


### Bug Fixes

* **kernel:** install missing webpack.config.js ([e5ed5c9](https://github.com/valaatech/kernel/commit/e5ed5c910ac416cd38ce2440367100dcfdc4bccf))
* **type-vault:** invalid tags with vlm configure --default-tags ([be23103](https://github.com/valaatech/kernel/commit/be23103822c792d59e79af4acf63bf3e7a7d2787))
* **valma:** Suppress missing node_modules warnings ([409614c](https://github.com/valaatech/kernel/commit/409614cac627510058f99b8bd7a87d160d838494))
* web-api rule disjoin to null-type, getSession restructure ([563f649](https://github.com/valaatech/kernel/commit/563f6496082ca2b70627ba5fc9770f080d53a202))


### Features

* Add session auto refresh with route rule autoRefreshSession ([ef78f8f](https://github.com/valaatech/kernel/commit/ef78f8f584366bb5b76dadff8ffa557742062b4f))
* Add web-spindle template project to type-worker ([8980747](https://github.com/valaatech/kernel/commit/8980747a6e3c9b767ee76023162a2c22b0028c14))





# [0.35.0-rc.15](https://github.com/valaatech/kernel/compare/v0.35.0-rc.14...v0.35.0-rc.15) (2020-04-28)


### Bug Fixes

* destroyed resource internal exceptions, also streamline debugId ([7053a14](https://github.com/valaatech/kernel/commit/7053a14cbfd30534923c57b5e54eb31ce3a5ccb5))
* empty editor content due to react property lambdas behavior change ([187d9ac](https://github.com/valaatech/kernel/commit/187d9ac69444f13af5e2e0374957fd904adf6d4d))
* valma package reload ([037b964](https://github.com/valaatech/kernel/commit/037b9642361d0a07e4abc984a96a83b2e3c56516))





# [0.35.0-rc.14](https://github.com/valaatech/kernel/compare/v0.35.0-rc.13...v0.35.0-rc.14) (2020-04-27)


### Bug Fixes

* various minor bugs ([3cfe81a](https://github.com/valaatech/kernel/commit/3cfe81a21898c023d4316fc784f2f27298869d7c))


### Features

* add vlm init --repository option ([ef819ba](https://github.com/valaatech/kernel/commit/ef819ba50d1e1ec517242a85bae7d3e0326cfd37))





# [0.35.0-rc.13](https://github.com/valaatech/kernel/compare/v0.35.0-rc.12...v0.35.0-rc.13) (2020-04-25)

**Note:** Version bump only for package @valos/kernel-vault





# [0.35.0-rc.12](https://github.com/valaatech/kernel/compare/v0.35.0-rc.11...v0.35.0-rc.12) (2020-04-21)


### Features

* VPath JSON sections and outlines ([7ea2a14](https://github.com/valaatech/kernel/commit/7ea2a14c43a6ed0174d42161c66557bd52b6d387))





# [0.35.0-rc.11](https://github.com/valaatech/kernel/compare/v0.35.0-rc.10...v0.35.0-rc.11) (2020-04-09)


### Features

* Add postSession for refreshing the session token ([d580da8](https://github.com/valaatech/kernel/commit/d580da8dc44241fe42dcfb360df0e04672e6819d))





# [0.35.0-rc.10](https://github.com/valaatech/kernel/compare/v0.35.0-rc.9...v0.35.0-rc.10) (2020-04-03)


### Features

* Revelation expose; recursively reveals all nested mysteries ([916d94e](https://github.com/valaatech/kernel/commit/916d94e3fb0e7242276dd9c2f4eaab0a98897ff0))
* vlm configure --default-tags options ([dbe1b3e](https://github.com/valaatech/kernel/commit/dbe1b3e349b160ca7fb2d97e275a6e047a9bfc1f))





# [0.35.0-rc.9](https://github.com/valaatech/kernel/compare/v0.35.0-rc.8...v0.35.0-rc.9) (2020-03-26)


### Bug Fixes

* Add delayed handling to revelation downloads ([4ca31db](https://github.com/valaatech/kernel/commit/4ca31db09af3f628cf1f35ed78bbbd9f762901ff))
* Missing valma.getVerbosity, export-chronicle vpaths, options.parent ([d40a11d](https://github.com/valaatech/kernel/commit/d40a11d735c0d0a959bfcb7eb05edfe133cfb9c4))


### Features

* Add Gateway prologue chronicle.connection and its .remote option ([47b6280](https://github.com/valaatech/kernel/commit/47b628066320bd045ac6ec6dfa59763945a738c8))
* Add Gateway.setupHostComponents ([cb2e39d](https://github.com/valaatech/kernel/commit/cb2e39d6928776c8ff4c7015d9072b98cd8a6e05))





# [0.35.0-rc.8](https://github.com/valaatech/kernel/compare/v0.35.0-rc.7...v0.35.0-rc.8) (2020-03-24)


### Bug Fixes

* Merge UNSAFE_componentWillMount into UIComponent.constructor ([b4f00ec](https://github.com/valaatech/kernel/commit/b4f00ec9f61eb07ed3fd7dd35ca6e5a7ccc56375))
* Revert vw100, vh100 to apply only to ROOT_LENS, VIEW_LENS ([4782f83](https://github.com/valaatech/kernel/commit/4782f83dea81edadc35c2e5b4740cf0752d4f6b5))


### Features

* Add getSession projector scope.crypto and clientTokenFields parsing ([ab8894a](https://github.com/valaatech/kernel/commit/ab8894a9d459caff16cd4def0ebd2f2492227b5c))





# [0.35.0-rc.7](https://github.com/valaatech/kernel/compare/v0.35.0-rc.6...v0.35.0-rc.7) (2020-03-23)


### Bug Fixes

* Missing source location on some errors ([83e9d4d](https://github.com/valaatech/kernel/commit/83e9d4df29be3a996bceb308137bef4a28dfd0fa))
* Remove 100vw 100vh root div wrapper (and the isHTMLRoot flag) ([9cdda0c](https://github.com/valaatech/kernel/commit/9cdda0ccd3d0022cf7c78623a666a70b689622e3))


### Features

* Have type vault config inherit the package.json:repository for git ([0db9a72](https://github.com/valaatech/kernel/commit/0db9a72bf64367dc99e8f07a76efeb6d9dc98b49))





# [0.35.0-rc.6](https://github.com/valaatech/kernel/compare/v0.35.0-rc.5...v0.35.0-rc.6) (2020-03-19)


### Bug Fixes

* flip createChronicleURI and createPartitionURI semantics ([4eff03c](https://github.com/valaatech/kernel/commit/4eff03c96dd01a1052d1e20c1a81bfcafebc44e9))
* Have session expiry clear cookies and redirect to clientRedirectPath ([a4e1316](https://github.com/valaatech/kernel/commit/a4e1316f1fd38cc6c61f174078170b19c023764e))
* path.posix. to path., logging, other fixes ([8c1c854](https://github.com/valaatech/kernel/commit/8c1c854b518a4bb8e95c13e2d4a66034775480ab))
* **valma:** sub-command non-optional arguments, filenameFromCommand ([102c1fe](https://github.com/valaatech/kernel/commit/102c1fedbeaa796963e5067fe03efe917ef5dc6f))





# [0.35.0-rc.5](https://github.com/valaatech/kernel/compare/v0.35.0-rc.4...v0.35.0-rc.5) (2020-01-29)


### Bug Fixes

* Ignore malformed vdoc:ref's for now ([b2acddc](https://github.com/valaatech/kernel/commit/b2acddc07f40d7f8386119acbc43dacc16c08bab))





# [0.35.0-rc.4](https://github.com/valaatech/kernel/compare/v0.35.0-rc.3...v0.35.0-rc.4) (2020-01-29)

**Note:** Version bump only for package @valos/kernel





# [0.35.0-rc.3](https://github.com/valaatech/kernel/compare/v0.35.0-rc.2...v0.35.0-rc.3) (2020-01-21)


### Features

* Add dumpObject.expandFields option ([d846158](https://github.com/valaatech/kernel/commit/d846158184d3394e9d3dd0b7ae947d9bd0e61963))
* Add full implicit .json support to revelations ([1c50e75](https://github.com/valaatech/kernel/commit/1c50e75b085cc60d667a38b2692381cf43a89eb9))





# [0.35.0-rc.2](https://github.com/valaatech/kernel/compare/v0.35.0-rc.1...v0.35.0-rc.2) (2020-01-15)


### Features

* rule 'assembleSessionPayload', scope.sessionPayload ([fda5148](https://github.com/valaatech/kernel/commit/fda514833e2bc99544c08cc6d433f08755bcb8ae))





# [0.35.0-rc.1](https://github.com/valaatech/kernel/compare/v0.35.0-rc.0...v0.35.0-rc.1) (2020-01-13)


### Features

* Combine gateway-api/identity with IdentityManager ([8f769b1](https://github.com/valaatech/kernel/commit/8f769b1bc95a97cdbca5b4e6ab7bfd4d5543d331))





# [0.35.0-rc.0](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.23...v0.35.0-rc.0) (2020-01-08)


### Bug Fixes

* [#619](https://github.com/valaatech/kernel/issues/619) Null values in array Properties return a Vrapper ([b19ff2e](https://github.com/valaatech/kernel/commit/b19ff2e45476bc5784632a0872aa3aee48edfacd))


### Features

* Add CONNECT, HEAD, OPTIONS and TRACE bridges ([a737e46](https://github.com/valaatech/kernel/commit/a737e469ef02a2d52e53805d5b0cab700ea3195c))
* **web-spindle:** Media, Entity and Relation resource responses ([4ca1462](https://github.com/valaatech/kernel/commit/4ca1462ea93dad6938b91b14c2aba563aa2d6323))





# [0.35.0-prerelease.23](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.22...v0.35.0-prerelease.23) (2020-01-06)


### Bug Fixes

* schema config & only forward unset headers from forwarded response ([36162a9](https://github.com/valaatech/kernel/commit/36162a9d36380f0f56275d0b74b1577c8b31a4e2))


### Features

* **web-spindle:** Fill reply status, headers from fetch passthru response ([cad7645](https://github.com/valaatech/kernel/commit/cad7645151ead0408f1bebb0e8b53995c0092fce))
* $V.getSubResource, new Thing({ subResource: "@_:foo@@" }) ([446e726](https://github.com/valaatech/kernel/commit/446e72677c094c4dce7f5490d7e5488f9c791c65))





# [0.35.0-prerelease.22](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.21...v0.35.0-prerelease.22) (2020-01-03)


### Bug Fixes

* **web-spindle:** WEB_API_LENS, delay scopeBase getViewScope preload phase ([3713660](https://github.com/valaatech/kernel/commit/37136609d1a9b9dd67c35bd3e95a021a595a4ec6))


### Features

* Expose fetch, Headers, Request and Response via inspire valosheath ([143c4c9](https://github.com/valaatech/kernel/commit/143c4c95850432585baeedd0649c0f910ca28d4a))





# [0.35.0-prerelease.21](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.20...v0.35.0-prerelease.21) (2020-01-01)


### Features

* Add bridge projectors ([82b8955](https://github.com/valaatech/kernel/commit/82b89558ddfe98acccbe8f11f2f0ce901c34a4d8))
* Add bridge routes to schema-builder ([af45bfa](https://github.com/valaatech/kernel/commit/af45bfad235a1829c864cf4f37e8668cab956811))
* runtimeRules, runtime.resolvers and resolveToScope ([e9de16a](https://github.com/valaatech/kernel/commit/e9de16af4ef1cfb3a7a7cca525a63e624639c1fb))





# [0.35.0-prerelease.20](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.19...v0.35.0-prerelease.20) (2019-12-24)


### Features

* Add valos.vrefer, res.$V.vref with inactive reference support ([ec15e9c](https://github.com/valaatech/kernel/commit/ec15e9c8016bb831218bd19b59056662b8c698c6))





# [0.35.0-prerelease.19](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.18...v0.35.0-prerelease.19) (2019-12-18)


### Bug Fixes

* postMapping sync issues ([15ce407](https://github.com/valaatech/kernel/commit/15ce4072dfb7243ec675abda392ad7eb5354a05d))
* **rest-api-spindle:** deleteSession, postMapping, reorder info events ([f51c684](https://github.com/valaatech/kernel/commit/f51c684a1eb8caacbf9fa5b48e28981bef1f6af2))
* **rest-api-spindle:** Extract toMappingSource from toMapping ([b0ce29f](https://github.com/valaatech/kernel/commit/b0ce29f27b0420809be0c94edc834761fc51a79e))


### Features

* **rest-api-spindle:** Add listing live preload kuery ([7809e1f](https://github.com/valaatech/kernel/commit/7809e1f5ee47a4e258d177d70f1a86adc03adcc5))
* Add support for nested PATCHing, simplify href/rel code ([ed4016f](https://github.com/valaatech/kernel/commit/ed4016f5f0b5cad03aaa6223c979a64462ff734e))
* **rest-api-spindle:** Add multi-identity authorization check ([4dd401b](https://github.com/valaatech/kernel/commit/4dd401b318ec1ba7f596e3ca6230471e6c3f4503))
* **rest-api-spindle:** Parallelize live preloads ([2e2107b](https://github.com/valaatech/kernel/commit/2e2107b4326e52c3ccbe38d45775930b23e34b68))





# [0.35.0-prerelease.18](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.17...v0.35.0-prerelease.18) (2019-12-14)


### Features

* Add chronicleURI aliases, Cog.getEngine, fetch, fixes ([464f600](https://github.com/valaatech/kernel/commit/464f6002414a92c8ed76e5ce348ca9356d830cf3))
* Add session and access control tests, scope.sessionIdentity ([90384e4](https://github.com/valaatech/kernel/commit/90384e442805c928ba73b5cca2a418723811f8e3))
* Separate requiredRuntimeRules from requiredRules ([eb44138](https://github.com/valaatech/kernel/commit/eb44138039ed881663cd113e33d466e0c9f00b1b))





# [0.35.0-prerelease.17](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.16...v0.35.0-prerelease.17) (2019-12-12)


### Bug Fixes

* Pre-existing cross-chronicle reference prevents resource creation ([82dba04](https://github.com/valaatech/kernel/commit/82dba04ec62ef0082ab07b65568550d20d1380ec))


### Features

* Add @valos/inspire/rekuery for importing valoscript files in node ([686a9eb](https://github.com/valaatech/kernel/commit/686a9eb1eacc6577d18ae1e42d04d7e3807649d8))
* Add Vrapper.getURI, valos.tools .Chronicle, some fixes ([58c3030](https://github.com/valaatech/kernel/commit/58c3030abcdf9cfa132d17db8d8f6fad64c80a7e))
* dev/env ignore, vlm.execute.onProcess ([cae28ee](https://github.com/valaatech/kernel/commit/cae28eed24a6ce37595699b6f7108024c16f28ef))
* Gateway.getAttachedSpindle, Vrapper.activate to resolve to self ([a716edd](https://github.com/valaatech/kernel/commit/a716edd3694352ec5e992031b9e08ebb692f9e77))
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


### Features

* Add patchWith option complexPatch for patching with complex objects ([dbfd5c7](https://github.com/valaatech/kernel/commit/dbfd5c7ea7b3e923dc96964498e9f7f374e39f5e))
* Add revelation.views and revelation.spindles sections ([a85c079](https://github.com/valaatech/kernel/commit/a85c079690215742ecb0984437c45d18edffdb53))





# [0.35.0-prerelease.14](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.13...v0.35.0-prerelease.14) (2019-11-07)


### Bug Fixes

* Minor ontology, perspire --spindle-ids, ([ab1a5e2](https://github.com/valaatech/kernel/commit/ab1a5e2ea0fc4f7834903d638166e958f40b5627))
* testdoc generation during assemble-packages ([31d894c](https://github.com/valaatech/kernel/commit/31d894cf61420f86faa37e987ff547f941bc4a6e))
* valma help, type-vault configure issue with workspaces ([1fbc649](https://github.com/valaatech/kernel/commit/1fbc6496046d3d03a419fb30d9f9dbc06bd7f974))


### Features

* Add bindExpandedVPath contextState for callback state ([0893fb2](https://github.com/valaatech/kernel/commit/0893fb2248b4f4060ae5a795c36909599fdd896a))
* Add object and sequence support to VPath binding ([c7d5873](https://github.com/valaatech/kernel/commit/c7d58733db05ec8dbdaf210d889bed44d215c7e0))
* Add regenerate-docs name-pattern for selective revdoc regeneration ([e27d57d](https://github.com/valaatech/kernel/commit/e27d57d7783bf4bccdec9785df3a5d7a3210d0f2))
* Add schema-builder routes, projections and site config testdoc chapter ([39a4528](https://github.com/valaatech/kernel/commit/39a452847fef94b1d79839c08237fd75549acb0a))
* Add valos-raem:Verb and revela ontology ([db80949](https://github.com/valaatech/kernel/commit/db8094973fb0f033a9b375418a334a48aa29e070))
* Add VPath minting and validator functions ([9a2e86a](https://github.com/valaatech/kernel/commit/9a2e86a6007243e231dfe6638a55ca92a3374e76))
* Docs example side pane, paragraphization, title anchors ([d3a5e63](https://github.com/valaatech/kernel/commit/d3a5e6350f8fbdfd7c115492a3530fb4e487ea4d))
* expressors, impressors and resolvers ([4acb9a3](https://github.com/valaatech/kernel/commit/4acb9a39ea7d0bdf218a25478ae109a3aa231600))
* Implement VPath expanded form helpers ([5aec6da](https://github.com/valaatech/kernel/commit/5aec6da0a56c5eef2b28343c427d4ddd218a90a7))
* removed-from ontology ([c61116f](https://github.com/valaatech/kernel/commit/c61116f2e2e768f190fa6f310d3b20e5e2bcc908))
* Update schema-builder, add testdoc ([fbf88d4](https://github.com/valaatech/kernel/commit/fbf88d40dbb0877274864a07202d2329ad3e40fe))
* vlm write-revdoc --testdoc ([4adc9a3](https://github.com/valaatech/kernel/commit/4adc9a3b9619ba399e6539070cd3011f4975e0ba))





# [0.35.0-prerelease.13](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.12...v0.35.0-prerelease.13) (2019-09-06)


### Features

* domain tool draft-command for domain configure script ([048894a](https://github.com/valaatech/kernel/commit/048894a))





# [0.35.0-prerelease.12](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.11...v0.35.0-prerelease.12) (2019-09-05)


### Bug Fixes

* various 'vlm init' issues ([1d06418](https://github.com/valaatech/kernel/commit/1d06418))





# [0.35.0-prerelease.11](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.10...v0.35.0-prerelease.11) (2019-09-03)

**Note:** Version bump only for package @valos/kernel





# [0.35.0-prerelease.10](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.9...v0.35.0-prerelease.10) (2019-09-03)


### Bug Fixes

* Split double-newlines in vdoc:entries, escape html entities ([112db2a](https://github.com/valaatech/kernel/commit/112db2a))


### Features

* Add abnf and turtle revdoc format blocks ([7d72116](https://github.com/valaatech/kernel/commit/7d72116))
* Add sourcerer valospace and event aspects ontology drafts ([9603027](https://github.com/valaatech/kernel/commit/9603027))





# [0.35.0-prerelease.9](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.8...v0.35.0-prerelease.9) (2019-08-16)


### Bug Fixes

* Add generate-domain-summary --summary for release-vault workflow ([b0c6d9a](https://github.com/valaatech/kernel/commit/b0c6d9a))


### Features

* Add revdoc:Example, #example, revdoc:Invokation, invokation() ([c141073](https://github.com/valaatech/kernel/commit/c141073))
* valos:Property hypertwin fields ([c78d5fb](https://github.com/valaatech/kernel/commit/c78d5fb))





# [0.35.0-prerelease.8](https://github.com/valaatech/vault/compare/v0.35.0-prerelease.7...v0.35.0-prerelease.8) (2019-07-24)


### Bug Fixes

* lint ([2056ebf](https://github.com/valaatech/vault/commit/2056ebf))
* vlm configure, init bugs ([1f6793f](https://github.com/valaatech/vault/commit/1f6793f))





# [0.35.0-prerelease.7](https://github.com/valaatech/vault/compare/v0.35.0-prerelease.6...v0.35.0-prerelease.7) (2019-07-18)


### Bug Fixes

* revealer/rest-api selector isDisabled ([83b74e7](https://github.com/valaatech/vault/commit/83b74e7))


### Features

* Standard toolset vlm configure process ([fb05d05](https://github.com/valaatech/vault/commit/fb05d05))





# [0.35.0-prerelease.6](https://github.com/valaatech/vault/compare/v0.35.0-prerelease.5...v0.35.0-prerelease.6) (2019-07-16)

**Note:** Version bump only for package @valos/kernel





# [0.35.0-prerelease.5](https://github.com/valaatech/vault/compare/v0.35.0-prerelease.4...v0.35.0-prerelease.5) (2019-07-14)


### Features

* **toolset-vault:** Add revdocs/* support to regenerate-sbom ([a97117e](https://github.com/valaatech/vault/commit/a97117e))





# [0.35.0-prerelease.4](https://github.com/valaatech/vault/compare/v0.35.0-prerelease.3...v0.35.0-prerelease.4) (2019-07-12)


### Bug Fixes

* **toolset-vault:** Rename @valos/workshop to ..kernel, vdoc:title -> dc:title ([f0043bf](https://github.com/valaatech/vault/commit/f0043bf))





# [0.35.0-prerelease.3](https://github.com/valaatech/vault/compare/v0.35.0-prerelease.2...v0.35.0-prerelease.3) (2019-07-10)

**Note:** Version bump only for package @valos/kernel





# [0.35.0-prerelease.2](https://github.com/valaatech/vault/compare/v0.35.0-prerelease.1...v0.35.0-prerelease.2) (2019-07-01)

**Note:** Version bump only for package @valos/vault





# [0.35.0-prerelease.1](https://github.com/valaatech/vault/compare/v0.35.0-prerelease.0...v0.35.0-prerelease.1) (2019-06-26)


### Bug Fixes

* various minor toolset issues ([9bef7c9](https://github.com/valaatech/vault/commit/9bef7c9))





# [0.35.0-prerelease.0](https://github.com/valaatech/vault/compare/v0.34.0...v0.35.0-prerelease.0) (2019-06-14)


### Bug Fixes

* **toolset-vault:** set lerna bump with appropriate pre(patch|minor|major) ([1492e62](https://github.com/valaatech/vault/commit/1492e62))





# [0.34.0](https://github.com/valaatech/vault/compare/v0.34.0-rc.3...v0.34.0) (2019-06-14)


### Bug Fixes

* missing perspire log timeStamp, support null store descriptor ([5f85519](https://github.com/valaatech/vault/commit/5f85519))





# [0.34.0-rc.3](https://github.com/valaatech/vault/compare/v0.34.0-rc.2...v0.34.0-rc.3) (2019-06-12)


### Bug Fixes

* missing Vrapper.getTransient issue ([7a0dc9b](https://github.com/valaatech/vault/commit/7a0dc9b))





# [0.34.0-rc.2](https://github.com/valaatech/vault/compare/v0.34.0-rc.1...v0.34.0-rc.2) (2019-06-10)


### Bug Fixes

* pending Valoscope props now use the lens slots of parent component ([1ac95b3](https://github.com/valaatech/vault/commit/1ac95b3))
* UIComponent now properly resolves a Promise focuses coming from arrays ([f88ffb6](https://github.com/valaatech/vault/commit/f88ffb6))





# [0.34.0-rc.1](https://github.com/valaatech/vault/compare/v0.34.0-rc.0...v0.34.0-rc.1) (2019-06-07)


### Bug Fixes

* proper partition command extraction for upgradeEventTo0Dot2 ([09caea3](https://github.com/valaatech/vault/commit/09caea3))
* vlm catastrophic error with -da when builder throws ([55b8d1c](https://github.com/valaatech/vault/commit/55b8d1c))





# [0.34.0-rc.0](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.32...v0.34.0-rc.0) (2019-06-03)


### Bug Fixes

* Add check for missing meta/operation ([66d94b6](https://github.com/valaatech/vault/commit/66d94b6))





# [0.34.0-prerelease.32](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.31...v0.34.0-prerelease.32) (2019-06-02)


### Bug Fixes

* embedded live kueries by adding lensName to sequence renders ([02035da](https://github.com/valaatech/vault/commit/02035da))
* Prevent purge with non-schismatic chronicle exceptions ([63cd3b4](https://github.com/valaatech/vault/commit/63cd3b4))





# [0.34.0-prerelease.31](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.30...v0.34.0-prerelease.31) (2019-05-29)

**Note:** Version bump only for package @valos/vault





# [0.34.0-prerelease.30](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.29...v0.34.0-prerelease.30) (2019-05-27)


### Bug Fixes

* **606:** infinite forceUpdate loop with undefined live kuery value ([c8b4da9](https://github.com/valaatech/vault/commit/c8b4da9))





# [0.34.0-prerelease.29](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.28...v0.34.0-prerelease.29) (2019-05-13)


### Bug Fixes

* Prevent .vs functions from being live ([2e76df5](https://github.com/valaatech/vault/commit/2e76df5))





# [0.34.0-prerelease.28](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.27...v0.34.0-prerelease.28) (2019-05-08)


### Bug Fixes

* Infinite re-render loop with broken Media's ([0e6782b](https://github.com/valaatech/vault/commit/0e6782b))





# [0.34.0-prerelease.27](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.26...v0.34.0-prerelease.27) (2019-05-08)


### Bug Fixes

* 601, 602 - Desync when refreshing browser while media write to authority not completed ([ba59e88](https://github.com/valaatech/vault/commit/ba59e88))





# [0.34.0-prerelease.26](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.25...v0.34.0-prerelease.26) (2019-05-06)

**Note:** Version bump only for package @valos/vault





# [0.34.0-prerelease.25](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.24...v0.34.0-prerelease.25) (2019-05-04)


### Bug Fixes

* option; inner kueries are now embedded ([b4ffcb4](https://github.com/valaatech/vault/commit/b4ffcb4))





# [0.34.0-prerelease.24](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.23...v0.34.0-prerelease.24) (2019-05-03)

**Note:** Version bump only for package @valos/vault





# [0.34.0-prerelease.23](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.22...v0.34.0-prerelease.23) (2019-04-30)


### Bug Fixes

* Various fixes and renames ([7eb8456](https://github.com/valaatech/vault/commit/7eb8456))





# [0.34.0-prerelease.22](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.21...v0.34.0-prerelease.22) (2019-04-18)


### Bug Fixes

* broken vs/vsx error traces ([f385944](https://github.com/valaatech/vault/commit/f385944))





# [0.34.0-prerelease.21](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.20...v0.34.0-prerelease.21) (2019-04-16)


### Bug Fixes

* Alter primitive field regression, adds test ([d37560b](https://github.com/valaatech/vault/commit/d37560b))
* IdentityManager partition authority bug, adds .get ([048efa1](https://github.com/valaatech/vault/commit/048efa1))





# [0.34.0-prerelease.20](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.19...v0.34.0-prerelease.20) (2019-04-13)


### Bug Fixes

* Merge outputError into enableError via optional second argument ([0255588](https://github.com/valaatech/vault/commit/0255588))
* **593:** Add renarration/rechronicle FalseProphetP*C* semantics ([bf187b5](https://github.com/valaatech/vault/commit/bf187b5))





# [0.34.0-prerelease.19](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.18...v0.34.0-prerelease.19) (2019-04-04)


### Bug Fixes

* "sourceURL", allowActivating, dead code removal, className content ([17a6ddf](https://github.com/valaatech/vault/commit/17a6ddf))
* remove "wrap = new Error" idiom from thenChainEagerly for 5% perf boost ([a86ae43](https://github.com/valaatech/vault/commit/a86ae43))
* **592:** Valaa-memory gets stored to cloud ([2400896](https://github.com/valaatech/vault/commit/2400896))
* **inspire:** revert 'head' removal from scope ([0117aba](https://github.com/valaatech/vault/commit/0117aba))
* **script:** missing kueryFromAst.options call sites ([2296d16](https://github.com/valaatech/vault/commit/2296d16))





# [0.34.0-prerelease.18](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.17...v0.34.0-prerelease.18) (2019-03-15)


### Bug Fixes

* Don't block event playback for 404 with allowBrokenDownloads ([32df214](https://github.com/valaatech/vault/commit/32df214))





# [0.34.0-prerelease.17](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.16...v0.34.0-prerelease.17) (2019-03-13)


### Bug Fixes

* **591, 576:** instance frames got incorrect owner implicitly added ([a9a0f5e](https://github.com/valaatech/vault/commit/a9a0f5e))
* **prophet:** schism bug with only meta.partitionURI ([f8319e5](https://github.com/valaatech/vault/commit/f8319e5))
* InactiveResource issue with unordered partition load ([d115bcf](https://github.com/valaatech/vault/commit/d115bcf))
* Missing valaaspace stack trace logging for .vsx files ([fa6164d](https://github.com/valaatech/vault/commit/fa6164d))





# [0.34.0-prerelease.16](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.15...v0.34.0-prerelease.16) (2019-03-11)


### Bug Fixes

* Don't re-narrate prologue, add perspire stopClockEvent, others ([1707e2d](https://github.com/valaatech/vault/commit/1707e2d))





# [0.34.0-prerelease.15](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.14...v0.34.0-prerelease.15) (2019-03-08)

**Note:** Version bump only for package @valos/vault





# [0.34.0-prerelease.14](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.13...v0.34.0-prerelease.14) (2019-03-06)


### Bug Fixes

* Conflict revise & merge regression ([5301dac](https://github.com/valaatech/vault/commit/5301dac))
* **588:** Making non-conflicting change while receiving updates causes an error ([5f58015](https://github.com/valaatech/vault/commit/5f58015))





# [0.34.0-prerelease.13](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.12...v0.34.0-prerelease.13) (2019-03-06)


### Bug Fixes

* **564:** NoScope with promise as focus causes a browser freeze ([4110f76](https://github.com/valaatech/vault/commit/4110f76))
* **584:** Repointing LENS when it is being rendered freezes browser ([f7b3640](https://github.com/valaatech/vault/commit/f7b3640))
* **585:** Media writing / reading behaves weirdly - as if media cache in memory lags behind ([9019eb0](https://github.com/valaatech/vault/commit/9019eb0))
* **toolset-rest-api-gateway-plugin:** regression caused by PATCH on nested properties ([ecafb7a](https://github.com/valaatech/vault/commit/ecafb7a))





# [0.34.0-prerelease.12](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.11...v0.34.0-prerelease.12) (2019-03-04)

**Note:** Version bump only for package @valos/vault





# [0.34.0-prerelease.11](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.10...v0.34.0-prerelease.11) (2019-03-04)

**Note:** Version bump only for package @valos/vault





# [0.34.0-prerelease.10](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.8...v0.34.0-prerelease.10) (2019-03-03)


### Bug Fixes

* **tools:** Adds missing gateway-api dependency, fixes cross-package import ([517ed32](https://github.com/valaatech/vault/commit/517ed32))
* **toolset-vault:** allow-unchanged -> add-unchanged ([b1dd624](https://github.com/valaatech/vault/commit/b1dd624))
* Disable bvob garbage collection deletion temporarily ([2d483e2](https://github.com/valaatech/vault/commit/2d483e2))





# [0.34.0-prerelease.9](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.8...v0.34.0-prerelease.9) (2019-02-28)


### Bug Fixes

* **tools:** Adds missing gateway-api dependency, fixes cross-package import ([3b59e36](https://github.com/valaatech/vault/commit/3b59e36))
* **toolset-vault:** allow-unchanged -> add-unchanged ([b1dd624](https://github.com/valaatech/vault/commit/b1dd624))





# [0.34.0-prerelease.8](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.7...v0.34.0-prerelease.8) (2019-02-25)


### Bug Fixes

* **565:** Creating events that edit ROOT_LENS may make partition unrenderable ([eb19bf4](https://github.com/valaatech/vault/commit/eb19bf4))
* **577:** setCommandCountListener doesn't work on gautama ([3162bb9](https://github.com/valaatech/vault/commit/3162bb9))
* **579:** Wrong error message ("Downloading") when VSX parse fails ([0424167](https://github.com/valaatech/vault/commit/0424167))





# [0.34.0-prerelease.7](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.6...v0.34.0-prerelease.7) (2019-02-21)


### Bug Fixes

* Improve vlm.exception and remove es6 code from valma dependencies ([b862b2f](https://github.com/valaatech/vault/commit/b862b2f))
* **toolset-rest-api-gateway-plugin:** Missing partition from listCollection getVrapper ([96cebbc](https://github.com/valaatech/vault/commit/96cebbc))
* **valma:** vlm . ||/&& ops with string results ([eedb981](https://github.com/valaatech/vault/commit/eedb981))
* lint errors ([73e9e3f](https://github.com/valaatech/vault/commit/73e9e3f))





# [0.34.0-prerelease.6](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.5...v0.34.0-prerelease.6) (2019-02-18)


### Bug Fixes

* Lock yalc to 1.0.0-pre.23 ([5338bb5](https://github.com/valaatech/vault/commit/5338bb5))
* ValaaScript missing source map issue, other logging ([68a6f01](https://github.com/valaatech/vault/commit/68a6f01))





# [0.34.0-prerelease.5](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.4...v0.34.0-prerelease.5) (2019-02-12)


### Bug Fixes

* Temporary demotes of some exceptions to error messages ([79b0777](https://github.com/valaatech/vault/commit/79b0777))





# [0.34.0-prerelease.4](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.3...v0.34.0-prerelease.4) (2019-02-10)

**Note:** Version bump only for package @valos/vault





# [0.34.0-prerelease.3](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.2...v0.34.0-prerelease.3) (2019-02-06)


### Bug Fixes

* refresh-no-immediate failure, missing fetch in perspire ([27455b6](https://github.com/valaatech/vault/commit/27455b6))





# [0.34.0-prerelease.2](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.1...v0.34.0-prerelease.2) (2019-02-06)


### Bug Fixes

* Add toolset and dom-string verbose-dumping to perspire ([85bce33](https://github.com/valaatech/vault/commit/85bce33))





# [0.34.0-prerelease.1](https://github.com/valaatech/vault/compare/v0.33.0...v0.34.0-prerelease.1) (2019-02-06)


### Bug Fixes

* async carryover issue in databaseops ([52728ce](https://github.com/valaatech/vault/commit/52728ce))
* better support for virtual dom (animationFrame) ([afcd22e](https://github.com/valaatech/vault/commit/afcd22e))
* demonstrate working revela.json preload on chrome with 'crossorigin' ([29db164](https://github.com/valaatech/vault/commit/29db164))
* instanceof URI check, jsdom creation to perspire.js ([f347ecb](https://github.com/valaatech/vault/commit/f347ecb))
* missing try-catch, blob -> bvob revelation transform ([b8a5087](https://github.com/valaatech/vault/commit/b8a5087))
* release branch name and lerna version bump mismatches ([496bd6c](https://github.com/valaatech/vault/commit/496bd6c))
* valma logging and pool bugs, text changes, toolset command bugs ([2485d9f](https://github.com/valaatech/vault/commit/2485d9f))
* window set to jsdom.window ([e7f38f2](https://github.com/valaatech/vault/commit/e7f38f2))





# [0.34.0-prerelease.0](https://github.com/valaatech/vault/compare/v0.33.0...v0.34.0-prerelease.0) (2019-02-03)

**Note:** Version bump only for package @valos/vault





# [0.33.0](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.13...v0.33.0) (2019-02-01)


### Bug Fixes

* Add missing upgrade path for MODIFIED actions ([3b898ad](https://github.com/valaatech/vault/commit/3b898ad))
* ghostHost incorrectly returned truthy values for non-ghosts ([d5b5ae4](https://github.com/valaatech/vault/commit/d5b5ae4))
* Prevent redundant receiveTruths when options.isTruth is set ([6b20fbe](https://github.com/valaatech/vault/commit/6b20fbe))
* subscribeEvents issue for non-prologue partitions ([7b2fbe8](https://github.com/valaatech/vault/commit/7b2fbe8))





# [0.33.0-prerelease.13](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.12...v0.33.0-prerelease.13) (2019-01-31)


### Bug Fixes

* Media Lens regression. ([f7d685b](https://github.com/valaatech/vault/commit/f7d685b))





# [0.33.0-prerelease.12](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.11...v0.33.0-prerelease.12) (2019-01-30)


### Bug Fixes

* SimpleBar css import issue with webpack ([6525afa](https://github.com/valaatech/vault/commit/6525afa))


### Features

* **toolset-vault:** Add nested babelrc support for packages/**/* ([e405c86](https://github.com/valaatech/vault/commit/e405c86))





# [0.33.0-prerelease.11](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.10...v0.33.0-prerelease.11) (2019-01-29)


### Bug Fixes

* mapEagerly to return onRejected result directly (not in results) ([5584432](https://github.com/valaatech/vault/commit/5584432))
* OracleP*C* now provides subscribeEvents: true for post-connect narrate ([c5cfe19](https://github.com/valaatech/vault/commit/c5cfe19))
* wrapError to cache objects to deal with circular nesting ([426608e](https://github.com/valaatech/vault/commit/426608e))





# [0.33.0-prerelease.10](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.9...v0.33.0-prerelease.10) (2019-01-23)


### Bug Fixes

* and test for $V.partitionURI regression ([08c9bf3](https://github.com/valaatech/vault/commit/08c9bf3))
* chronicle media sync race condition with tests ([3b11229](https://github.com/valaatech/vault/commit/3b11229))
* createBvob / Media.content race condition ([023bfaa](https://github.com/valaatech/vault/commit/023bfaa))
* demote missing initialState.owner exception to deprecation warning ([2ed5b87](https://github.com/valaatech/vault/commit/2ed5b87))
* Implement the VAKON-[] default breaking change also on subscriber side ([315d456](https://github.com/valaatech/vault/commit/315d456))
* indeterminable coupling for inactive resources ([c9e2cf2](https://github.com/valaatech/vault/commit/c9e2cf2))
* indexeddb validations, PartitionConnect.connect streamlining, others ([5f55c71](https://github.com/valaatech/vault/commit/5f55c71))
* lint ([c7e02d0](https://github.com/valaatech/vault/commit/c7e02d0))
* missing lexicalScope.this via interactive pathways ([b4b0036](https://github.com/valaatech/vault/commit/b4b0036))
* multiple minor fixes based on external test project ([834f99a](https://github.com/valaatech/vault/commit/834f99a))
* several wrapError issues ([2b32faa](https://github.com/valaatech/vault/commit/2b32faa))
* upstream mediaURL regression ([002a2e0](https://github.com/valaatech/vault/commit/002a2e0))





# [0.33.0-prerelease.9](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.8...v0.33.0-prerelease.9) (2019-01-15)


### Bug Fixes

* Don't use spread operator with 'options' objects ([5b90d10](https://github.com/valaatech/vault/commit/5b90d10))





# [0.33.0-prerelease.8](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.7...v0.33.0-prerelease.8) (2019-01-14)


### Bug Fixes

* Delete DESTROYED.typeName when upgrading event from 0.1 to 0.2 ([f1c7c68](https://github.com/valaatech/vault/commit/f1c7c68))
* ref.inactive issues, with transient merging specifically ([7d7e257](https://github.com/valaatech/vault/commit/7d7e257))
* Renames eventId -> eventRef where VRef is expected ([d4d0d00](https://github.com/valaatech/vault/commit/d4d0d00))
* wrapError clip failure, also context to use console.warn ([889313f](https://github.com/valaatech/vault/commit/889313f))





# [0.33.0-prerelease.7](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.6...v0.33.0-prerelease.7) (2019-01-03)


### Bug Fixes

* Connect sequencing issue with Scribe connections ([f8ca762](https://github.com/valaatech/vault/commit/f8ca762))
* Simplifies transaction nesting logic, fixes uncovered options bug ([9eb3582](https://github.com/valaatech/vault/commit/9eb3582))





# [0.33.0-prerelease.6](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.5...v0.33.0-prerelease.6) (2019-01-02)

**Note:** Version bump only for package @valos/vault





# [0.33.0-prerelease.5](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.4...v0.33.0-prerelease.5) (2018-12-30)

**Note:** Version bump only for package @valos/vault





# [0.33.0-prerelease.4](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.3...v0.33.0-prerelease.4) (2018-12-29)


### Bug Fixes

* Fix assemble-package --only-pending; --reassemble is now useful ([95e8570](https://github.com/valaatech/vault/commit/95e8570))





# [0.33.0-prerelease.3](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.2...v0.33.0-prerelease.3) (2018-12-18)


### Bug Fixes

* Add error.code and error.signal to vlm.execute re-throw ([16a3519](https://github.com/valaatech/vault/commit/16a3519))
* Allow freeze to modify Resource.owner (unless partition root) ([7b26b5c](https://github.com/valaatech/vault/commit/7b26b5c))


### Features

* Add out-of-order cross-partition instantiation & reference support ([2c121a2](https://github.com/valaatech/vault/commit/2c121a2))
* Introduce ContentAPI.inactiveType as the API-specific inactive type ([6476c7a](https://github.com/valaatech/vault/commit/6476c7a))





# [0.33.0-prerelease.2](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.1...v0.33.0-prerelease.2) (2018-11-22)


### Features

* **valma:** Add vlm.interact for tty-forwarding ([58df411](https://github.com/valaatech/vault/commit/58df411))





# [0.33.0-prerelease.1](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.0...v0.33.0-prerelease.1) (2018-11-21)


### Bug Fixes

* **toolset-vault:** Fix couple minor release-vault bugs ([b435ba7](https://github.com/valaatech/vault/commit/b435ba7))


### Features

* Add event validator version support and version "0.2" skeleton ([82c4a83](https://github.com/valaatech/vault/commit/82c4a83))
* Implement version 0.2 commandId & resourceId creation ([c65c1e6](https://github.com/valaatech/vault/commit/c65c1e6))
* **prophet:** Add EventAspects for managing events across the streams ([6952538](https://github.com/valaatech/vault/commit/6952538))
* **prophet:** Add sequential write queues to Scribe commands and truths ([ee6e18f](https://github.com/valaatech/vault/commit/ee6e18f))
* **prophet:** Implement FalseProphetPartitionConnection event queues ([473e3e2](https://github.com/valaatech/vault/commit/473e3e2))
* **prophet:** Make ChronicleEventResult a concrete type ([becb9d6](https://github.com/valaatech/vault/commit/becb9d6))
* **prophet:** Overhaul and generalize acquirePartitionConnection ([c3c0df1](https://github.com/valaatech/vault/commit/c3c0df1))
* **tools:** Add mapEagerly to thenChainEagerly ([525d1d9](https://github.com/valaatech/vault/commit/525d1d9))
* **toolset-vault:** Add release-vault --prerelease and advance support ([adf632f](https://github.com/valaatech/vault/commit/adf632f))





<a name="0.33.0-prerelease.0"></a>
# [0.33.0-prerelease.0](https://github.com/valaatech/vault/compare/v0.32.0...v0.33.0-prerelease.0) (2018-09-21)


<a name="0.32.0"></a>
# [0.32.0](https://github.com/valaatech/vault/compare/v0.31.1...v0.32.0) (2018-09-20)


### Bug Fixes

* [#453](https://github.com/valaatech/vault/issues/453) Media content of an instance doesn't change with the prototype ([333c335](https://github.com/valaatech/vault/commit/333c335))
* [#499](https://github.com/valaatech/vault/issues/499) Setting a Media's Blob to be a Blob on another partition causes failure ([ec7f0a4](https://github.com/valaatech/vault/commit/ec7f0a4))
* [#538](https://github.com/valaatech/vault/issues/538) getURL should provide a data object for large size medias when in local/inmemory partition ([4321706](https://github.com/valaatech/vault/commit/4321706))
* [#540](https://github.com/valaatech/vault/issues/540) getUrl provides faulty, mangled Data URLs ([cc45349](https://github.com/valaatech/vault/commit/cc45349))
* [#549](https://github.com/valaatech/vault/issues/549) childrenLens never finds children ([392c6af](https://github.com/valaatech/vault/commit/392c6af))
* Demote connection media validations (at least temporarily) ([493ba3f](https://github.com/valaatech/vault/commit/493ba3f))
* lints, prepareBvob, tests, logging ([71b2ed1](https://github.com/valaatech/vault/commit/71b2ed1))
* UI hangs on comparePropsOrState ([f1418e0](https://github.com/valaatech/vault/commit/f1418e0))


### Features

* [#547](https://github.com/valaatech/vault/issues/547) ValaaScope with a custom key makes itself available in 'frame' ([70d2c3d](https://github.com/valaatech/vault/commit/70d2c3d))
* Add 'vlm release-vault' for creating new releases ([3324848](https://github.com/valaatech/vault/commit/3324848))
* Add "frame" lens resource to all ValaaScope components ([b168cfd](https://github.com/valaatech/vault/commit/b168cfd))
* Add MediaInfo contentDisposition etc. and asURL variants ([07e10db](https://github.com/valaatech/vault/commit/07e10db))
* Add migration and deprecation for revelation and ValaaSpace Blob's ([bbaf48e](https://github.com/valaatech/vault/commit/bbaf48e))
* Add vlm clean-vault ([0b21e8f](https://github.com/valaatech/vault/commit/0b21e8f))
* Add vlm.delegate for background tasks ([1c9dd98](https://github.com/valaatech/vault/commit/1c9dd98))
* Extract chronicleEventLog from narrateEventLog, changes flags ([828bcd9](https://github.com/valaatech/vault/commit/828bcd9))
* Improve faulty valma command tolerance ([a216dee](https://github.com/valaatech/vault/commit/a216dee))
* Update lerna to 3.x and enable conventional commits CHANGELOG ([0e900df](https://github.com/valaatech/vault/commit/0e900df))





<a name="0.31.1"></a>
# [0.31.1](https://github.com/valaatech/vault/compare/v0.31.0...v0.31.1) (2018-08-30)

### :bug:

- `@valos/prophet`
   * Demote no-Media-entry severity so it doesn't block activation

<a name="0.31.0"></a>
# [0.31.0](https://github.com/valaatech/vault/compare/v0.30.0...v0.31.0) (2018-08-30)

> First relatively quicker release. Contains mostly bugfixes (which are
> not listed) and minor enchancement features of the inspire UI
> functionality.

> Major functionalities of note:
> - groundwork for `perspire` server side VDOM computing
> - instance lenses
> - the live `*.props.class` CSS idiom

### :satellite: New ValaaSpace Feature

- `@valos/inspire`
  * Add support for live *.props.key values ([@iridiankin](https://github.com/iridiankin))
  * Change Valaa.Lens.loadingLens default bg color to a friendlier blue ([@iridiankin](https://github.com/iridiankin))
  * Introduce instance lenses ([@iridiankin](https://github.com/iridiankin))
  * Add `TextFileEditor.props.confirmSave`.([@iridiankin](https://github.com/iridiankin))
  * Add live props `class={focus.someCSSMedia}` which enables the single mangled root class CSS -idiom. ([@iridiankin](https://github.com/iridiankin))
  * Add `Valaa.Lens.(focus|instance|delegate)(LensProperty|PropertyLens)`. ([@iridiankin](https://github.com/iridiankin))
  * Add `ValaaScope.props.array` for more intuitive sequence focus rendering. ([@iridiankin](https://github.com/iridiankin))
  * Add `Valaa.Lens.internalFailureLens`. ([@iridiankin](https://github.com/iridiankin))
- `@valos/engine`
  * Add namespaces functionality and the $V-is-for-ValOS namespace. ([@iridiankin](https://github.com/iridiankin))

### :nut_and_bolt: New Valaa Fabric Feature

- `@valos/inspire`
  * Add support for relative spreader paths in revelation files ([@iridiankin](https://github.com/iridiankin))
  * Add PerspireServer and PerspireView using jsdom for VDOM computation ([@ismotee](https://github.com/ismotee))
- `@valos/tools`
  * Add indexeddbshim option for Scribe on non-browser environments. ([@ismotee](https://github.com/ismotee))
  * Add vdoc for jsdoc-like structured VDON docs. ([@iridiankin](https://github.com/iridiankin))
- `@valos/toolset-revealer`
  * Add `vlm perspire` for launching Node.js-based revelation VDOM computation. ([@ismotee](https://github.com/ismotee))

### :house: Internal

- `*`
  * Add setTitleKuery option for createAndConnectViewsToDOM. ([@iridiankin](https://github.com/iridiankin))
  * Updates babel dependencies to 7.0.0

<a name="0.30.0"></a>
# [0.30.0](https://github.com/valaatech/vault/compare/86d3f54...v0.30.0) (2018-08-07)

> This is the first major release after source base restructuring from
> the poorly organized ValaaLabs repository into @valos/vault which
> contains all necessary Valaa Open System libraries and tools in a
> better organized structure.
>
> In addition to the restructuring this release adds `valma`,
> the package command discovery and dispatch tool that is used to
> manage ValOS repositories and packages. This release also adds
> following toolsets and their associated valma scripts:
> - `toolset-vault` for managing ValOS vaults (like this repository)
> - `toolset-revealer` for launching local dev servers and building
>    dist bundles
> - `toolset-authollery` for managing infrastructure resources
