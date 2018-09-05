# Changelog

> **Tags:**
> - :boom:         [Breaking Change]
> - :satellite:    [New ValaaSpace Feature]
> - :nut_and_bolt: [New Valaa Fabric Feature]
> - :bug:          [Bug Fix]
> - :memo:         [Documentation]
> - :house:        [Internal]
> - :nail_care:    [Polish]

_Note: Gaps between patch versions are faulty, broken or test releases._

## v0.31.1 (2018-08-30)

#### :bug:

- `@valos/prophet`
   * Demote no-Media-entry severity so it doesn't block activation

## v0.31.0 (2018-08-30)

> First relatively quicker release. Contains mostly bugfixes (which are
> not listed) and minor enchancement features of the inspire UI
> functionality.

> Major functionalities of note:
> - groundwork for `perspire` server side VDOM computing
> - instance lenses
> - the live `*.props.class` CSS idiom

#### :satellite: New ValaaSpace Feature

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

#### :nut_and_bolt: New Valaa Fabric Feature

- `@valos/inspire`
  * Add support for relative spreader paths in revelation files ([@iridiankin](https://github.com/iridiankin))
  * Add PerspireServer and PerspireView using jsdom for VDOM computation ([@ismotee](https://github.com/ismotee))
- `@valos/tools`
  * Add indexeddbshim option for Scribe on non-browser environments. ([@ismotee](https://github.com/ismotee))
  * Add vdoc for jsdoc-like structured VDON docs. ([@iridiankin](https://github.com/iridiankin))
- `@valos/toolset-revealer`
  * Add `vlm perspire` for launching Node.js-based revelation VDOM computation. ([@ismotee](https://github.com/ismotee))

#### :house: Internal

- `*`
  * Add setTitleKuery option for createAndConnectViewsToDOM. ([@iridiankin](https://github.com/iridiankin))
  * Updates babel dependencies to 7.0.0

## v0.30.0 (2018-08-07)

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
