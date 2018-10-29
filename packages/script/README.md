# @valos/script extends Javascript with ValOS-RAEM as `ValaaScript`

ValaaScript is a semantic, non-syntactic extension of Javascript which
seamlessly integrates Valaa resources with the Javascript object model.
Bridges the gap between Javascript model and ValOS-RAEM by considerably
extending the schema. Provides an implementation for ValaaScript via
transpiling into VALK kueries as an intermediate language.

- depends: `@valos/raem`, `acorn`
- exports: `transpileValaaScript`, `VALSK`, `ScriptContentAPI`
- ValaaSpace: `Scope`, `Property`
- concepts: `ECMAScript2015`, `scope`, `transpilation`
