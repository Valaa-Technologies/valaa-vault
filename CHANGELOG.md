# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

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
