# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

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
