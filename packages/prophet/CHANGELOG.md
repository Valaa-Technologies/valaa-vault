# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

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
