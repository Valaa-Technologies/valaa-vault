# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

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
