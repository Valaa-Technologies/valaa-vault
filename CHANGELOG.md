# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

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
