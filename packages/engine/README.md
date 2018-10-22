# @valos/engine provides the ValaaRAEM object mapper and computation engine

Provides the live proxies (`Vrappers`) to ValaaSpace resources with
`ValaaEngine`. Completes the modifcation and transaction frameworks
with the ability to create commands using the proxy objects. Provides
Media content decoder framework, which allows converting
ValaaScript content inside ValaaSpace into executable code. This also
allows integrating existing javascript code through ValaaScript
seamless integration. Converts events into subscriber callbacks calls.
Together these enable fully live-updating ValaaScript code via VALK
kueries as intermediate language. Exposes ValaaScript standard API
into ValaaSpace as `Valaa` execution environment global scope
primitive, with which ValaaScript programs have full control over
computation, stream connectivity and rendering environment inside the
browser.

- depends: `@valos/prophet`
- exports: `ValaaEngine`, `Vrapper`, `VALEK`
- ValaaSpace: `Valaa.*`, `Object integration`
- concepts: `live kuery`, `code-as-content`, `3rd party libraries`
