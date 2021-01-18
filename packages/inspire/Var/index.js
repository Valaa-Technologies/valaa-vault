const { ref } = require("@valos/revdoc/extractee");
const { buildNamespaceSpecification } = require("@valos/tools/namespace");

module.exports = buildNamespaceSpecification({
  domain: "@valos/kernel",
  preferredPrefix: "Var",
  baseIRI: "https://valospace.org/inspire/Var/0#",
  namespaceModules: {
    VKernel: "@valos/kernel/VKernel",
    V: "@valos/space/V",
    On: "@valos/sourcerer/On",
    VEngine: "@valos/engine/VEngine",
    Lens: "@valos/inspire/Lens",
  },
  description: [
`This namespace contains the names of the reserved lexical scope
variables that are usable inside a VSX lens medias.

Additionally, the Var: namespace can be used as a UI component
attribute prefix for defining new arbitrary variables. The identifier
name of these variables is the suffix of the attribute without the
'Var:' prefix and they are are lexically visible (inside this VSX lens
only) to all nested sub-scopes of the component.

This differs from 'Context:' variables which are dynamically scoped and
are visible to all internal sub-components (ie. possibly to lenses
defined by other VSX medias) and which might get overridden for
some nested sub-scopes by the internals of some intermediary component.

`,
  ],
  declareNames,
});

function declareNames ({ declareName }) {
  declareName("this", {
    tags: ["Inspire", "VSX", "Lexical"],
    type: "Media",
    description: [
`The originating Media resource of this lens.`,
null,
`Cannot be defined or assigned. Automatically defined during VSX media
integration.

When 'this' is used inside an unbound non-arrow function or inside an
arrow function that is defined within the lens itself, Inspire UI will
provide the Media as the value of 'this'. Here the value is thus
equivalent to the value outside the function body.

However as per javascript semantics, when 'this' appears inside a bound
non-arrow function or inside an arrow function has been defined
elsewhere, the value of 'this' is defined by the originating binding
context.
`,
    ],
  });

  declareName("focus", {
    tags: ["Inspire", "VSX", "Lexical"],
    type: "any",
    description: [
`The current focus of this lens.`,
null,
`Cannot be defined or assigned; instead see the `, ref("Lens:focus"),
` component attribute for how to specify the focus for component
sub-elements.`,
    ],
  });

  declareName("frame", {
    tags: ["Inspire", "VSX", "Lexical"],
    type: "Resource",
    description: [
`The frame resource of the innermost surrounding Valoscope component.`,
null,
`Cannot be defined or assigned; instead see the `, ref("Lens:frame"),
` component attribute for how frame resource is constructed and how to
specify the frame resource identity.`,
    ],
  });

  declareName("context", {
    tags: ["Inspire", "VSX", "Lexical"],
    type: "Context",
    description: [
`The context object of the innermost surrounding component.`,
null,
`Cannot be defined assigned; instead see the `, ref("Lens:context"),
` component attribute for how to merge new context properties for the
sub-elements of this component.`,
    ],
  });
}
