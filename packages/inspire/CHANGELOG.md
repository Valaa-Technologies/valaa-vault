# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.37.0-prerelease.1](https://github.com/valaatech/kernel/compare/v0.37.0-prerelease.0...v0.37.0-prerelease.1) (2021-04-14)


### Bug Fixes

* Minor fixes and document updates ([5e836b1](https://github.com/valaatech/kernel/commit/5e836b14bb399bfa47350b4e8274dee7ff6cd00e))
* Regression bugs caught by test suite ([f77890a](https://github.com/valaatech/kernel/commit/f77890a972bb74e482bc31431050ac848180d43b))
* Various minor fixes and logging improvements ([ed7866f](https://github.com/valaatech/kernel/commit/ed7866fd7aca7791b71040e089f82f138a84fb2f))


### Features

* Add "meta" section to all spindle prototypes ([3af199e](https://github.com/valaatech/kernel/commit/3af199e66f229dd66e4003868f93dc9789c76370))
* **inspire:** Allow both "module.exports =" and "export default" for spindles ([ef8d0aa](https://github.com/valaatech/kernel/commit/ef8d0aa4ac3b7dd01010c2c40ec2b410939ddeb1))
* **inspire:** Allow null rootChronicleURI and foci for non-browser contexts ([ef07a78](https://github.com/valaatech/kernel/commit/ef07a783f82faf1032fcf0ea1e8886a7f6573cdb))
* **sourcerer:** Replace naiveURI with *.(create|split)ChronicleURI pipeline ([d75a1f2](https://github.com/valaatech/kernel/commit/d75a1f20715f40d9efdf582d703737e498759762))
* **web-spindle:** Import projectors from other spindles ([5058816](https://github.com/valaatech/kernel/commit/5058816891c6772e6c0bd1bbef132b93f27b644f))





# [0.37.0-prerelease.0](https://github.com/valaatech/kernel/compare/v0.37.0-alpha.6...v0.37.0-prerelease.0) (2021-02-16)


### Features

* **inspire:** Add valos.attachView, some fixes ([78ebb81](https://github.com/valaatech/kernel/commit/78ebb81fbe408e9966d08cd9c12d74421fd21bb6))





# [0.37.0-alpha.6](https://github.com/valaatech/kernel/compare/v0.37.0-alpha.5...v0.37.0-alpha.6) (2021-01-28)


### Features

* **inspire:** Add isFullscreen view option, deprecates "isView", "isRoot" ([220d844](https://github.com/valaatech/kernel/commit/220d8445fc5e4498072da147aeff50c29181f455))
* **inspire:** Add valos.initialize, valos.createView and prologue.root ([0fa03bc](https://github.com/valaatech/kernel/commit/0fa03bceb322ed30d49d63241c5eb3288e376e8a))





# [0.37.0-alpha.5](https://github.com/valaatech/kernel/compare/v0.37.0-alpha.4...v0.37.0-alpha.5) (2021-01-18)


### Bug Fixes

* ProphecyOperation swallows unrecoverable errors ([8815fbc](https://github.com/valaatech/kernel/commit/8815fbc2e917ea56d10c28e852ba25091749b7c6))
* Various minor bugs ([c47ec68](https://github.com/valaatech/kernel/commit/c47ec6882f5d9dffcce3922896d904b644a097a5))
* **inspire:** Trivial On:click handlers do not translate as onClick ([61803ef](https://github.com/valaatech/kernel/commit/61803ef346ee53f6a422920d455e9bfb5f11a647))


### Features

* **inspire:** Add stack trace visualizations to VSX attribute errors ([1d453dc](https://github.com/valaatech/kernel/commit/1d453dc1514797dc7b753619a02912f1b1a3e498))
* **inspire:** Set lens "this" to be originating Media ([cbcd415](https://github.com/valaatech/kernel/commit/cbcd4156b90554aa6f581e05ac53b7d59e579dbc))





# [0.37.0-alpha.4](https://github.com/valaatech/kernel/compare/v0.37.0-alpha.3...v0.37.0-alpha.4) (2021-01-09)


### Bug Fixes

* **699:** Chronicle activation does not cause live trigger? ([b900df2](https://github.com/valaatech/kernel/commit/b900df2b1783af8bda898150e0dc4d030b763272))
* **702:** Instance lens does not work as the only element in VSX ([acf1595](https://github.com/valaatech/kernel/commit/acf1595e9cdb6bb2bf7d03a9dd47b4b3cb2cec64))





# [0.37.0-alpha.3](https://github.com/valaatech/kernel/compare/v0.37.0-alpha.2...v0.37.0-alpha.3) (2021-01-08)


### Bug Fixes

* **#698:** Inline-including context.this.something causes context.this to be wonky ([4aecc88](https://github.com/valaatech/kernel/commit/4aecc88496e2de2642440a363ff92cf68601b49a)), closes [#698](https://github.com/valaatech/kernel/issues/698)
* Revert generic attribute function wrapping back to selective ones ([bde4fb2](https://github.com/valaatech/kernel/commit/bde4fb27b8a5401df4d63c9f4fd3b0d76604ab07))


### Features

* individualOf for revelation templates ([0dd723e](https://github.com/valaatech/kernel/commit/0dd723e67f9f2254d79a597370ec6631f9eda7b3))





# [0.37.0-alpha.2](https://github.com/valaatech/kernel/compare/v0.37.0-alpha.1...v0.37.0-alpha.2) (2020-12-14)


### Bug Fixes

* Builtin Valens attribute with function value is not wrapped properly ([ef2ff8c](https://github.com/valaatech/kernel/commit/ef2ff8c23ef572c75f60a93d6cb7dae06966d514))





# [0.37.0-alpha.1](https://github.com/valaatech/kernel/compare/v0.37.0-alpha.0...v0.37.0-alpha.1) (2020-12-06)

**Note:** Version bump only for package @valos/inspire





# [0.37.0-alpha.0](https://github.com/valaatech/kernel/compare/v0.36.0-alpha.0...v0.37.0-alpha.0) (2020-12-04)


### Features

* Add terminate to Sourcerers with scribe option for deleting databases ([826fd0f](https://github.com/valaatech/kernel/commit/826fd0f1c41ad76be0b30a0350e71625287ad0d0))





# [0.36.0-alpha.0](https://github.com/valaatech/kernel/compare/v0.35.0...v0.36.0-alpha.0) (2020-11-10)

**Note:** Version bump only for package @valos/inspire





# [0.35.0](https://github.com/valaatech/kernel/compare/v0.35.0-rc.36...v0.35.0) (2020-11-08)

**Note:** Version bump only for package @valos/inspire





# [0.35.0-rc.36](https://github.com/valaatech/kernel/compare/v0.35.0-rc.35...v0.35.0-rc.36) (2020-11-04)


### Bug Fixes

* "entities" and "relations" do not live update on resource creation ([38c6a65](https://github.com/valaatech/kernel/commit/38c6a65aad22edbfac0f6e2fe83d7c41bdc5a107))


### Features

* valoscript namespace symbol via $-tagged literals: $`V:name` ([fb2668e](https://github.com/valaatech/kernel/commit/fb2668ea7656269a594250f2836ebe776bfa4879))





# [0.35.0-rc.35](https://github.com/valaatech/kernel/compare/v0.35.0-rc.34...v0.35.0-rc.35) (2020-10-18)


### Bug Fixes

* <Valoscope array> issues with non-triggering of Valens-handling ([cf58797](https://github.com/valaatech/kernel/commit/cf5879737ace38d8c920e4c63b918a15fb45ff3d))





# [0.35.0-rc.34](https://github.com/valaatech/kernel/compare/v0.35.0-rc.33...v0.35.0-rc.34) (2020-10-13)


### Features

* chainOp ([114e5cb](https://github.com/valaatech/kernel/commit/114e5cbc49d898c42d40fcee0573bc0cb1544021))
* Logging sessions with opLog and opEvent ([fe3f7fb](https://github.com/valaatech/kernel/commit/fe3f7fb0cce902e94dcb3fc81e7fbe943bdbd20f))
* proclaim -> full reform support using event.reformAfterAll ([04ad1dd](https://github.com/valaatech/kernel/commit/04ad1ddd23363eaacaca180585f6769078da6aa2))





# [0.35.0-rc.33](https://github.com/valaatech/kernel/compare/v0.35.0-rc.32...v0.35.0-rc.33) (2020-10-04)


### Bug Fixes

* Ontology revdoc generation issues ([d710690](https://github.com/valaatech/kernel/commit/d7106900d7a0eb4489192375336fede6a8c6df07))


### Features

* Add @valos/space library and move 'V' namespace specification to it ([20b00cd](https://github.com/valaatech/kernel/commit/20b00cd207f73ccfd7a78703480f141c861e7758))
* Add @valos/state library and the VState namespace ([d129897](https://github.com/valaatech/kernel/commit/d129897aa91fe378cc12ffed21baca6b14fab544))
* Add @valos/valk library and the VValk namespace ([97a9090](https://github.com/valaatech/kernel/commit/97a909064030556fafd6a59d67c533365efdca18))
* Add fabricator ProgressEvent events to 'On' namespace ([7705e7c](https://github.com/valaatech/kernel/commit/7705e7c61b768b43e9e99a89633adf8dbe2945da))
* Add On: namespace event handling to Valens ([116e5b6](https://github.com/valaatech/kernel/commit/116e5b6983a4cbbc5741498efa8ba4b6cf13cee9))





# [0.35.0-rc.32](https://github.com/valaatech/kernel/compare/v0.35.0-rc.31...v0.35.0-rc.32) (2020-09-24)

**Note:** Version bump only for package @valos/inspire





# [0.35.0-rc.31](https://github.com/valaatech/kernel/compare/v0.35.0-rc.30...v0.35.0-rc.31) (2020-09-23)


### Bug Fixes

* Add missing @valos/revdoc dependencies ([aef4072](https://github.com/valaatech/kernel/commit/aef40725d53072d49cc8a4df21d19e5c26da90e9))





# [0.35.0-rc.30](https://github.com/valaatech/kernel/compare/v0.35.0-rc.29...v0.35.0-rc.30) (2020-09-17)


### Bug Fixes

* VDoc q, c, cell, valma ([e5101df](https://github.com/valaatech/kernel/commit/e5101df882c86e6988c5d8380fd1b1fd3a52480d))


### Features

* Add "Lens" and "On" namespaces ([0be9e08](https://github.com/valaatech/kernel/commit/0be9e081c10e8b08923cf74c44e83a93331d13fc))
* Reference tooltips ([0e5790b](https://github.com/valaatech/kernel/commit/0e5790bc4805acd8be94dff2531ee6402e12c30d))





# [0.35.0-rc.29](https://github.com/valaatech/kernel/compare/v0.35.0-rc.28...v0.35.0-rc.29) (2020-08-27)


### Bug Fixes

* Add revealer peer dependency, revelationRoot for file routes ([26ed0e6](https://github.com/valaatech/kernel/commit/26ed0e6dae41130ef26389922c2cbffe0dcaed90))





# [0.35.0-rc.28](https://github.com/valaatech/kernel/compare/v0.35.0-rc.27...v0.35.0-rc.28) (2020-08-25)

**Note:** Version bump only for package @valos/inspire





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

* Structured sub-Property id generation from namespaced name ([e81ce9e](https://github.com/valaatech/kernel/commit/e81ce9e269750bf5e6a7370fb126fb0de0fcb218))


### Features

* $V.obtainSubResource ([5567940](https://github.com/valaatech/kernel/commit/5567940559c8807e03efa1d3add83841bacb06da))
* top-level 'require' access to spindle..valospaceRequirables ([833c971](https://github.com/valaatech/kernel/commit/833c9710fb15b81ab8410a260ef5c58422fa539d))





# [0.35.0-rc.24](https://github.com/valaatech/kernel/compare/v0.35.0-rc.23...v0.35.0-rc.24) (2020-08-10)

**Note:** Version bump only for package @valos/inspire





# [0.35.0-rc.23](https://github.com/valaatech/kernel/compare/v0.35.0-rc.22...v0.35.0-rc.23) (2020-08-04)


### Bug Fixes

* Qualified symbol valoscript loose comparisons ([7a4c5dc](https://github.com/valaatech/kernel/commit/7a4c5dc64aaced61e12762f81fe389ed77eed6bf))
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
* Formalize Lens.key with clean (if not so simple) semantics ([96d10f7](https://github.com/valaatech/kernel/commit/96d10f7341e0b8aad824075250eea178dae0383e))





# [0.35.0-rc.21](https://github.com/valaatech/kernel/compare/v0.35.0-rc.20...v0.35.0-rc.21) (2020-07-20)


### Features

* Add "live." and "static." vsx attribute namespace prefix options ([7ecf361](https://github.com/valaatech/kernel/commit/7ecf36153167d07cf689e62ba4af9fb732039c3f))
* Add "reuse" support to repeathenable lens kueries ([5eded21](https://github.com/valaatech/kernel/commit/5eded21844653e27e5be6612aa370c05e5eb6ac1))
* Add Lens.integrationScopeResource ([2884d93](https://github.com/valaatech/kernel/commit/2884d935760560459470117599deae1c3cca2089))
* frame override valoscope parameters ([6d23935](https://github.com/valaatech/kernel/commit/6d23935591d60f2c04f21bcdb747773fd602d5bf))
* Introduce thisChainRedirect - allows chain object return values ([ebb602c](https://github.com/valaatech/kernel/commit/ebb602c0df055a1a852aa2506ccf43a835f2889f))
* Lens.if/then/else ([66c0048](https://github.com/valaatech/kernel/commit/66c0048d1c2ac94a3fc98110cae31c2bd06b0167))
* valos.describe ([90b1d58](https://github.com/valaatech/kernel/commit/90b1d5893217c9889f2e0637fd03bd17e88cc6dd))





# [0.35.0-rc.20](https://github.com/valaatech/kernel/compare/v0.35.0-rc.19...v0.35.0-rc.20) (2020-06-28)


### Bug Fixes

* Return grandparent scopes to getLexicalScope ([de09ba7](https://github.com/valaatech/kernel/commit/de09ba798b84992118a1c39edc991420f0fb3d91))
* **662:** Quoted out content in VSX throws exception when in an empty element ([8dc2fc2](https://github.com/valaatech/kernel/commit/8dc2fc2c4ae37873978e8521b65719dff7e359c4))
* **674:** Better error message for empty media ([ef87dde](https://github.com/valaatech/kernel/commit/ef87ddec515e938429408fcddfeb180728b808dc))


### Features

* Add property-based media interpretation scoping ([2f470ba](https://github.com/valaatech/kernel/commit/2f470bacc6cb5ce20889c43021c44f6d85151e5d))
* Namespaced vsx element properties ([c0c7497](https://github.com/valaatech/kernel/commit/c0c749740623363ba499b14732bf134d961ef64c))





# [0.35.0-rc.19](https://github.com/valaatech/kernel/compare/v0.35.0-rc.18...v0.35.0-rc.19) (2020-06-11)

**Note:** Version bump only for package @valos/inspire





# [0.35.0-rc.18](https://github.com/valaatech/kernel/compare/v0.35.0-rc.17...v0.35.0-rc.18) (2020-06-10)


### Bug Fixes

* Gateway does not send identity properly ([3ffe05d](https://github.com/valaatech/kernel/commit/3ffe05d2cb99999b687a4358af296c6a468de256))





# [0.35.0-rc.17](https://github.com/valaatech/kernel/compare/v0.35.0-rc.16...v0.35.0-rc.17) (2020-06-03)

**Note:** Version bump only for package @valos/inspire





# [0.35.0-rc.16](https://github.com/valaatech/kernel/compare/v0.35.0-rc.15...v0.35.0-rc.16) (2020-05-18)


### Features

* Add session auto refresh with route rule autoRefreshSession ([ef78f8f](https://github.com/valaatech/kernel/commit/ef78f8f584366bb5b76dadff8ffa557742062b4f))





# [0.35.0-rc.15](https://github.com/valaatech/kernel/compare/v0.35.0-rc.14...v0.35.0-rc.15) (2020-04-28)


### Bug Fixes

* empty editor content due to react property lambdas behavior change ([187d9ac](https://github.com/valaatech/kernel/commit/187d9ac69444f13af5e2e0374957fd904adf6d4d))
* valma package reload ([037b964](https://github.com/valaatech/kernel/commit/037b9642361d0a07e4abc984a96a83b2e3c56516))





# [0.35.0-rc.14](https://github.com/valaatech/kernel/compare/v0.35.0-rc.13...v0.35.0-rc.14) (2020-04-27)

**Note:** Version bump only for package @valos/inspire





# [0.35.0-rc.13](https://github.com/valaatech/kernel/compare/v0.35.0-rc.12...v0.35.0-rc.13) (2020-04-25)

**Note:** Version bump only for package @valos/inspire





# [0.35.0-rc.12](https://github.com/valaatech/kernel/compare/v0.35.0-rc.11...v0.35.0-rc.12) (2020-04-21)


### Features

* VPath JSON sections and outlines ([7ea2a14](https://github.com/valaatech/kernel/commit/7ea2a14c43a6ed0174d42161c66557bd52b6d387))





# [0.35.0-rc.11](https://github.com/valaatech/kernel/compare/v0.35.0-rc.10...v0.35.0-rc.11) (2020-04-09)

**Note:** Version bump only for package @valos/inspire





# [0.35.0-rc.10](https://github.com/valaatech/kernel/compare/v0.35.0-rc.9...v0.35.0-rc.10) (2020-04-03)


### Features

* Revelation expose; recursively reveals all nested mysteries ([916d94e](https://github.com/valaatech/kernel/commit/916d94e3fb0e7242276dd9c2f4eaab0a98897ff0))





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





# [0.35.0-rc.7](https://github.com/valaatech/kernel/compare/v0.35.0-rc.6...v0.35.0-rc.7) (2020-03-23)


### Bug Fixes

* Missing source location on some errors ([83e9d4d](https://github.com/valaatech/kernel/commit/83e9d4df29be3a996bceb308137bef4a28dfd0fa))
* Remove 100vw 100vh root div wrapper (and the isHTMLRoot flag) ([9cdda0c](https://github.com/valaatech/kernel/commit/9cdda0ccd3d0022cf7c78623a666a70b689622e3))





# [0.35.0-rc.6](https://github.com/valaatech/kernel/compare/v0.35.0-rc.5...v0.35.0-rc.6) (2020-03-19)


### Bug Fixes

* path.posix. to path., logging, other fixes ([8c1c854](https://github.com/valaatech/kernel/commit/8c1c854b518a4bb8e95c13e2d4a66034775480ab))





# [0.35.0-rc.5](https://github.com/valaatech/kernel/compare/v0.35.0-rc.4...v0.35.0-rc.5) (2020-01-29)

**Note:** Version bump only for package @valos/inspire





# [0.35.0-rc.4](https://github.com/valaatech/kernel/compare/v0.35.0-rc.3...v0.35.0-rc.4) (2020-01-29)

**Note:** Version bump only for package @valos/inspire





# [0.35.0-rc.3](https://github.com/valaatech/kernel/compare/v0.35.0-rc.2...v0.35.0-rc.3) (2020-01-21)


### Features

* Add full implicit .json support to revelations ([1c50e75](https://github.com/valaatech/kernel/commit/1c50e75b085cc60d667a38b2692381cf43a89eb9))





# [0.35.0-rc.2](https://github.com/valaatech/kernel/compare/v0.35.0-rc.1...v0.35.0-rc.2) (2020-01-15)

**Note:** Version bump only for package @valos/inspire





# [0.35.0-rc.1](https://github.com/valaatech/kernel/compare/v0.35.0-rc.0...v0.35.0-rc.1) (2020-01-13)


### Features

* Combine gateway-api/identity with IdentityManager ([8f769b1](https://github.com/valaatech/kernel/commit/8f769b1bc95a97cdbca5b4e6ab7bfd4d5543d331))





# [0.35.0-rc.0](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.23...v0.35.0-rc.0) (2020-01-08)


### Features

* **web-spindle:** Media, Entity and Relation resource responses ([4ca1462](https://github.com/valaatech/kernel/commit/4ca1462ea93dad6938b91b14c2aba563aa2d6323))





# [0.35.0-prerelease.23](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.22...v0.35.0-prerelease.23) (2020-01-06)

**Note:** Version bump only for package @valos/inspire





# [0.35.0-prerelease.22](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.21...v0.35.0-prerelease.22) (2020-01-03)


### Features

* Expose fetch, Headers, Request and Response via inspire valosheath ([143c4c9](https://github.com/valaatech/kernel/commit/143c4c95850432585baeedd0649c0f910ca28d4a))





# [0.35.0-prerelease.21](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.20...v0.35.0-prerelease.21) (2020-01-01)

**Note:** Version bump only for package @valos/inspire





# [0.35.0-prerelease.20](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.19...v0.35.0-prerelease.20) (2019-12-24)

**Note:** Version bump only for package @valos/inspire





# [0.35.0-prerelease.19](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.18...v0.35.0-prerelease.19) (2019-12-18)

**Note:** Version bump only for package @valos/inspire





# [0.35.0-prerelease.18](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.17...v0.35.0-prerelease.18) (2019-12-14)


### Features

* Add chronicleURI aliases, Cog.getEngine, fetch, fixes ([464f600](https://github.com/valaatech/kernel/commit/464f6002414a92c8ed76e5ce348ca9356d830cf3))





# [0.35.0-prerelease.17](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.16...v0.35.0-prerelease.17) (2019-12-12)


### Features

* Add @valos/inspire/rekuery for importing valoscript files in node ([686a9eb](https://github.com/valaatech/kernel/commit/686a9eb1eacc6577d18ae1e42d04d7e3807649d8))
* Gateway.getAttachedSpindle, Vrapper.activate to resolve to self ([a716edd](https://github.com/valaatech/kernel/commit/a716edd3694352ec5e992031b9e08ebb692f9e77))





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

* Add revelation.views and revelation.spindles sections ([a85c079](https://github.com/valaatech/kernel/commit/a85c079690215742ecb0984437c45d18edffdb53))





# [0.35.0-prerelease.14](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.13...v0.35.0-prerelease.14) (2019-11-07)


### Features

* Add object and sequence support to VPath binding ([c7d5873](https://github.com/valaatech/kernel/commit/c7d58733db05ec8dbdaf210d889bed44d215c7e0))
* Add valos-raem:Verb and revela ontology ([db80949](https://github.com/valaatech/kernel/commit/db8094973fb0f033a9b375418a334a48aa29e070))





# [0.35.0-prerelease.13](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.12...v0.35.0-prerelease.13) (2019-09-06)

**Note:** Version bump only for package @valos/inspire





# [0.35.0-prerelease.12](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.11...v0.35.0-prerelease.12) (2019-09-05)

**Note:** Version bump only for package @valos/inspire





# [0.35.0-prerelease.11](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.10...v0.35.0-prerelease.11) (2019-09-03)

**Note:** Version bump only for package @valos/inspire





# [0.35.0-prerelease.10](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.9...v0.35.0-prerelease.10) (2019-09-03)


### Features

* Add sourcerer valospace and event aspects ontology drafts ([9603027](https://github.com/valaatech/kernel/commit/9603027))





# [0.35.0-prerelease.9](https://github.com/valaatech/kernel/compare/v0.35.0-prerelease.8...v0.35.0-prerelease.9) (2019-08-16)

**Note:** Version bump only for package @valos/inspire





# [0.35.0-prerelease.8](https://github.com/valaatech/vault/compare/v0.35.0-prerelease.7...v0.35.0-prerelease.8) (2019-07-24)

**Note:** Version bump only for package @valos/inspire





# [0.35.0-prerelease.7](https://github.com/valaatech/vault/compare/v0.35.0-prerelease.6...v0.35.0-prerelease.7) (2019-07-18)

**Note:** Version bump only for package @valos/inspire





# [0.35.0-prerelease.6](https://github.com/valaatech/vault/compare/v0.35.0-prerelease.5...v0.35.0-prerelease.6) (2019-07-16)

**Note:** Version bump only for package @valos/inspire





# [0.35.0-prerelease.5](https://github.com/valaatech/vault/compare/v0.35.0-prerelease.4...v0.35.0-prerelease.5) (2019-07-14)

**Note:** Version bump only for package @valos/inspire





# [0.35.0-prerelease.4](https://github.com/valaatech/vault/compare/v0.35.0-prerelease.3...v0.35.0-prerelease.4) (2019-07-12)

**Note:** Version bump only for package @valos/inspire





# [0.35.0-prerelease.3](https://github.com/valaatech/vault/compare/v0.35.0-prerelease.2...v0.35.0-prerelease.3) (2019-07-10)

**Note:** Version bump only for package @valos/inspire





# [0.35.0-prerelease.2](https://github.com/valaatech/vault/compare/v0.35.0-prerelease.1...v0.35.0-prerelease.2) (2019-07-01)

**Note:** Version bump only for package @valos/inspire





# [0.35.0-prerelease.1](https://github.com/valaatech/vault/compare/v0.35.0-prerelease.0...v0.35.0-prerelease.1) (2019-06-26)

**Note:** Version bump only for package @valos/inspire





# [0.35.0-prerelease.0](https://github.com/valaatech/vault/compare/v0.34.0...v0.35.0-prerelease.0) (2019-06-14)

**Note:** Version bump only for package @valos/inspire





# [0.34.0](https://github.com/valaatech/vault/compare/v0.34.0-rc.3...v0.34.0) (2019-06-14)

**Note:** Version bump only for package @valos/inspire





# [0.34.0-rc.3](https://github.com/valaatech/vault/compare/v0.34.0-rc.2...v0.34.0-rc.3) (2019-06-12)

**Note:** Version bump only for package @valos/inspire





# [0.34.0-rc.2](https://github.com/valaatech/vault/compare/v0.34.0-rc.1...v0.34.0-rc.2) (2019-06-10)


### Bug Fixes

* pending Valoscope props now use the lens slots of parent component ([1ac95b3](https://github.com/valaatech/vault/commit/1ac95b3))
* UIComponent now properly resolves a Promise focuses coming from arrays ([f88ffb6](https://github.com/valaatech/vault/commit/f88ffb6))





# [0.34.0-rc.1](https://github.com/valaatech/vault/compare/v0.34.0-rc.0...v0.34.0-rc.1) (2019-06-07)


### Bug Fixes

* proper partition command extraction for upgradeEventTo0Dot2 ([09caea3](https://github.com/valaatech/vault/commit/09caea3))





# [0.34.0-rc.0](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.32...v0.34.0-rc.0) (2019-06-03)

**Note:** Version bump only for package @valos/inspire





# [0.34.0-prerelease.32](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.31...v0.34.0-prerelease.32) (2019-06-02)


### Bug Fixes

* embedded live kueries by adding lensName to sequence renders ([02035da](https://github.com/valaatech/vault/commit/02035da))
* Prevent purge with non-schismatic chronicle exceptions ([63cd3b4](https://github.com/valaatech/vault/commit/63cd3b4))





# [0.34.0-prerelease.31](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.30...v0.34.0-prerelease.31) (2019-05-29)

**Note:** Version bump only for package @valos/inspire





# [0.34.0-prerelease.30](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.29...v0.34.0-prerelease.30) (2019-05-27)


### Bug Fixes

* **606:** infinite forceUpdate loop with undefined live kuery value ([c8b4da9](https://github.com/valaatech/vault/commit/c8b4da9))





# [0.34.0-prerelease.29](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.28...v0.34.0-prerelease.29) (2019-05-13)

**Note:** Version bump only for package @valos/inspire





# [0.34.0-prerelease.28](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.27...v0.34.0-prerelease.28) (2019-05-08)


### Bug Fixes

* Infinite re-render loop with broken Media's ([0e6782b](https://github.com/valaatech/vault/commit/0e6782b))





# [0.34.0-prerelease.27](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.26...v0.34.0-prerelease.27) (2019-05-08)

**Note:** Version bump only for package @valos/inspire





# [0.34.0-prerelease.26](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.25...v0.34.0-prerelease.26) (2019-05-06)

**Note:** Version bump only for package @valos/inspire





# [0.34.0-prerelease.25](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.24...v0.34.0-prerelease.25) (2019-05-04)


### Bug Fixes

* option; inner kueries are now embedded ([b4ffcb4](https://github.com/valaatech/vault/commit/b4ffcb4))





# [0.34.0-prerelease.24](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.23...v0.34.0-prerelease.24) (2019-05-03)

**Note:** Version bump only for package @valos/inspire





# [0.34.0-prerelease.23](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.22...v0.34.0-prerelease.23) (2019-04-30)


### Bug Fixes

* Various fixes and renames ([7eb8456](https://github.com/valaatech/vault/commit/7eb8456))





# [0.34.0-prerelease.22](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.21...v0.34.0-prerelease.22) (2019-04-18)


### Bug Fixes

* broken vs/vsx error traces ([f385944](https://github.com/valaatech/vault/commit/f385944))





# [0.34.0-prerelease.21](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.20...v0.34.0-prerelease.21) (2019-04-16)

**Note:** Version bump only for package @valos/inspire





# [0.34.0-prerelease.20](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.19...v0.34.0-prerelease.20) (2019-04-13)


### Bug Fixes

* Merge outputError into enableError via optional second argument ([0255588](https://github.com/valaatech/vault/commit/0255588))





# [0.34.0-prerelease.19](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.18...v0.34.0-prerelease.19) (2019-04-04)


### Bug Fixes

* **inspire:** revert 'head' removal from scope ([0117aba](https://github.com/valaatech/vault/commit/0117aba))
* "sourceURL", allowActivating, dead code removal, className content ([17a6ddf](https://github.com/valaatech/vault/commit/17a6ddf))





# [0.34.0-prerelease.18](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.17...v0.34.0-prerelease.18) (2019-03-15)

**Note:** Version bump only for package @valos/inspire





# [0.34.0-prerelease.17](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.16...v0.34.0-prerelease.17) (2019-03-13)


### Bug Fixes

* Missing valaaspace stack trace logging for .vsx files ([fa6164d](https://github.com/valaatech/vault/commit/fa6164d))





# [0.34.0-prerelease.16](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.15...v0.34.0-prerelease.16) (2019-03-11)


### Bug Fixes

* Don't re-narrate prologue, add perspire stopClockEvent, others ([1707e2d](https://github.com/valaatech/vault/commit/1707e2d))





# [0.34.0-prerelease.15](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.14...v0.34.0-prerelease.15) (2019-03-08)

**Note:** Version bump only for package @valos/inspire





# [0.34.0-prerelease.14](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.13...v0.34.0-prerelease.14) (2019-03-06)

**Note:** Version bump only for package @valos/inspire





# [0.34.0-prerelease.13](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.12...v0.34.0-prerelease.13) (2019-03-06)


### Bug Fixes

* **564:** NoScope with promise as focus causes a browser freeze ([4110f76](https://github.com/valaatech/vault/commit/4110f76))
* **585:** Media writing / reading behaves weirdly - as if media cache in memory lags behind ([9019eb0](https://github.com/valaatech/vault/commit/9019eb0))





# [0.34.0-prerelease.12](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.11...v0.34.0-prerelease.12) (2019-03-04)

**Note:** Version bump only for package @valos/inspire





# [0.34.0-prerelease.11](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.10...v0.34.0-prerelease.11) (2019-03-04)

**Note:** Version bump only for package @valos/inspire





# [0.34.0-prerelease.10](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.8...v0.34.0-prerelease.10) (2019-03-03)

**Note:** Version bump only for package @valos/inspire





# [0.34.0-prerelease.9](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.8...v0.34.0-prerelease.9) (2019-02-28)

**Note:** Version bump only for package @valos/inspire





# [0.34.0-prerelease.8](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.7...v0.34.0-prerelease.8) (2019-02-25)


### Bug Fixes

* **565:** Creating events that edit ROOT_LENS may make partition unrenderable ([eb19bf4](https://github.com/valaatech/vault/commit/eb19bf4))
* **577:** setCommandCountListener doesn't work on gautama ([3162bb9](https://github.com/valaatech/vault/commit/3162bb9))
* **579:** Wrong error message ("Downloading") when VSX parse fails ([0424167](https://github.com/valaatech/vault/commit/0424167))





# [0.34.0-prerelease.7](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.6...v0.34.0-prerelease.7) (2019-02-21)


### Bug Fixes

* Improve vlm.exception and remove es6 code from valma dependencies ([b862b2f](https://github.com/valaatech/vault/commit/b862b2f))
* lint errors ([73e9e3f](https://github.com/valaatech/vault/commit/73e9e3f))





# [0.34.0-prerelease.6](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.5...v0.34.0-prerelease.6) (2019-02-18)

**Note:** Version bump only for package @valos/inspire





# [0.34.0-prerelease.5](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.4...v0.34.0-prerelease.5) (2019-02-12)

**Note:** Version bump only for package @valos/inspire





# [0.34.0-prerelease.4](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.3...v0.34.0-prerelease.4) (2019-02-10)

**Note:** Version bump only for package @valos/inspire





# [0.34.0-prerelease.3](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.2...v0.34.0-prerelease.3) (2019-02-06)

**Note:** Version bump only for package @valos/inspire





# [0.34.0-prerelease.2](https://github.com/valaatech/vault/compare/v0.34.0-prerelease.1...v0.34.0-prerelease.2) (2019-02-06)


### Bug Fixes

* Add toolset and dom-string verbose-dumping to perspire ([85bce33](https://github.com/valaatech/vault/commit/85bce33))





# [0.34.0-prerelease.1](https://github.com/valaatech/vault/compare/v0.33.0...v0.34.0-prerelease.1) (2019-02-06)


### Bug Fixes

* better support for virtual dom (animationFrame) ([afcd22e](https://github.com/valaatech/vault/commit/afcd22e))
* instanceof URI check, jsdom creation to perspire.js ([f347ecb](https://github.com/valaatech/vault/commit/f347ecb))
* valma logging and pool bugs, text changes, toolset command bugs ([2485d9f](https://github.com/valaatech/vault/commit/2485d9f))
* window set to jsdom.window ([e7f38f2](https://github.com/valaatech/vault/commit/e7f38f2))





# [0.34.0-prerelease.0](https://github.com/valaatech/vault/compare/v0.33.0...v0.34.0-prerelease.0) (2019-02-03)

**Note:** Version bump only for package @valos/inspire





# [0.33.0](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.13...v0.33.0) (2019-02-01)

**Note:** Version bump only for package @valos/inspire





# [0.33.0-prerelease.13](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.12...v0.33.0-prerelease.13) (2019-01-31)


### Bug Fixes

* Media Lens regression. ([f7d685b](https://github.com/valaatech/vault/commit/f7d685b))





# [0.33.0-prerelease.12](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.11...v0.33.0-prerelease.12) (2019-01-30)


### Bug Fixes

* SimpleBar css import issue with webpack ([6525afa](https://github.com/valaatech/vault/commit/6525afa))





# [0.33.0-prerelease.11](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.10...v0.33.0-prerelease.11) (2019-01-29)

**Note:** Version bump only for package @valos/inspire





# [0.33.0-prerelease.10](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.9...v0.33.0-prerelease.10) (2019-01-23)


### Bug Fixes

* Implement the VAKON-[] default breaking change also on subscriber side ([315d456](https://github.com/valaatech/vault/commit/315d456))





# [0.33.0-prerelease.9](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.8...v0.33.0-prerelease.9) (2019-01-15)

**Note:** Version bump only for package @valos/inspire





# [0.33.0-prerelease.8](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.7...v0.33.0-prerelease.8) (2019-01-14)


### Bug Fixes

* Renames eventId -> eventRef where VRef is expected ([d4d0d00](https://github.com/valaatech/vault/commit/d4d0d00))
* wrapError clip failure, also context to use console.warn ([889313f](https://github.com/valaatech/vault/commit/889313f))





# [0.33.0-prerelease.7](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.6...v0.33.0-prerelease.7) (2019-01-03)


### Bug Fixes

* Simplifies transaction nesting logic, fixes uncovered options bug ([9eb3582](https://github.com/valaatech/vault/commit/9eb3582))





# [0.33.0-prerelease.6](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.5...v0.33.0-prerelease.6) (2019-01-02)

**Note:** Version bump only for package @valos/inspire





# [0.33.0-prerelease.5](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.4...v0.33.0-prerelease.5) (2018-12-30)

**Note:** Version bump only for package @valos/inspire





# [0.33.0-prerelease.4](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.3...v0.33.0-prerelease.4) (2018-12-29)

**Note:** Version bump only for package @valos/inspire





# [0.33.0-prerelease.3](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.2...v0.33.0-prerelease.3) (2018-12-18)

**Note:** Version bump only for package @valos/inspire





# [0.33.0-prerelease.2](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.1...v0.33.0-prerelease.2) (2018-11-22)

**Note:** Version bump only for package @valos/inspire





# [0.33.0-prerelease.1](https://github.com/valaatech/vault/compare/v0.33.0-prerelease.0...v0.33.0-prerelease.1) (2018-11-21)


### Features

* **prophet:** Overhaul and generalize acquirePartitionConnection ([c3c0df1](https://github.com/valaatech/vault/commit/c3c0df1))
* Add event validator version support and version "0.2" skeleton ([82c4a83](https://github.com/valaatech/vault/commit/82c4a83))
* Implement version 0.2 commandId & resourceId creation ([c65c1e6](https://github.com/valaatech/vault/commit/c65c1e6))





<a name="0.33.0-prerelease.0"></a>
# [0.33.0-prerelease.0](https://github.com/valaatech/vault/compare/v0.32.0...v0.33.0-prerelease.0) (2018-09-21)

<a name="0.32.0"></a>
# [0.32.0](https://github.com/valaatech/vault/compare/v0.31.1...v0.32.0) (2018-09-20)


### Bug Fixes

* [#549](https://github.com/valaatech/vault/issues/549) childrenLens never finds children ([392c6af](https://github.com/valaatech/vault/commit/392c6af))
* lints, prepareBvob, tests, logging ([71b2ed1](https://github.com/valaatech/vault/commit/71b2ed1))
* UI hangs on comparePropsOrState ([f1418e0](https://github.com/valaatech/vault/commit/f1418e0))


### Features

* [#547](https://github.com/valaatech/vault/issues/547) ValaaScope with a custom key makes itself available in 'frame' ([70d2c3d](https://github.com/valaatech/vault/commit/70d2c3d))
* Add "frame" lens resource to all ValaaScope components ([b168cfd](https://github.com/valaatech/vault/commit/b168cfd))
* Add migration and deprecation for revelation and ValaaSpace Blob's ([bbaf48e](https://github.com/valaatech/vault/commit/bbaf48e))
* Extract chronicleEventLog from narrateEventLog, changes flags ([828bcd9](https://github.com/valaatech/vault/commit/828bcd9))
