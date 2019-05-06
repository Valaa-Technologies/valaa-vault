# @valos/engine provides the ValOS-RAEM object mapper and computation engine

Provides the live proxies (`Vrappers`) to valospace resources with
`Engine`. Completes the modifcation and transaction frameworks
with the ability to create commands using the proxy objects. Provides
Media content decoder framework, which allows converting
valoscript content inside valospace into executable code. This also
allows integrating existing javascript code through valoscript
seamless integration. Converts events into subscriber callbacks calls.
Together these enable fully live-updating valoscript code via VALK
kueries as intermediate language. Exposes valoscript standard API
into valospace as `valos` execution environment global scope
primitive, with which valoscript programs have full control over
computation, stream connectivity and rendering environment inside the
browser.

- depends: `@valos/sourcerer`
- exports: `Engine`, `Vrapper`, `VALEK`
- valospace: `valos.*`, `Object integration`
- concepts: `live kuery`, `code-as-content`, `3rd party libraries`
