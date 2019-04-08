# @valos/script extends JavaScript with ValOS-RAEM as `valoscript`

Valoscript is a semantic, non-syntactic extension of Javascript which
seamlessly integrates ValOS resources with the JavaScript object model.
Bridges the gap between JavaScript model and ValOS-RAEM by considerably
extending the schema. Provides an implementation for valoscript via
transpiling into VALK kueries as an intermediate language.

- depends: `@valos/raem`, `acorn`
- exports: `transpileValoscript`, `VALSK`, `ScriptContentAPI`
- valosheath: `Scope`, `Property`
- concepts: `ECMAScript2015`, `scope`, `transpilation`
