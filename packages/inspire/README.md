# @valos/inspire provides the ValOS browser gateway and DOM UI renderer

Provides the runtime entry point and UI rendering integration using
`React`. Sets up the full gateway stack. Manages initial authentication
and connects to the entry chronicle. Sets up the rendering module,
attaches it to DOM and renders the entry chronicle `LENS`. Renders
resources using attached `lens` Media files. Introduces a Media type
`VSX` (similar to `JSX`) specifically for this purpose, which allows
writing natural HTML but also embedding it with fully live valoscript
snippets. With promise-enabled rendering enables fully dynamic
valospace integration with the UI.

- depends: `@valos/engine`, `React`, `brace`
- exports: `createInspireClient`,
- valospace: `Valoscope`, `If`, `ForEach`, `TextFileEditor`
- concepts: `model-view`, `HTML5/CSS/JS`, `rapid devevelopment`
