// @flow

import React from "react";

import { denoteValOSCallable } from "~/raem/VALK";

import Vrapper from "~/engine/Vrapper";
import debugId from "~/engine/debugId";
import { dumpObject } from "~/engine/VALEK";

import { dumpify, messageFromError, thenChainEagerly, wrapError } from "~/tools";

const defineName = require("@valos/engine/valosheath/defineName");
const { extractee: { em, ref, vsx } } = require("@valos/revdoc");

function tag (tagName, ...rest) { return [em(tagName), ...rest]; }

module.exports = {
  domain: "@valos/kernel",
  preferredPrefix: "Lens",
  baseIRI: "https://valospace.org/inspire/Lens/0#",
  namespaceModules: {
    VKernel: "@valos/kernel/VKernel",
    V: "@valos/kernel/V",
    VEngine: "@valos/engine/VEngine",
    Lens: "@valos/inspire/Lens",
    On: "@valos/inspire/On",
  },
  description: [
`The 'Lens' namespace defines the primary valospace UI component
vocabulary. This vocabulary is the API between the UI code written by
a valonaut and the @valos/inspire UI engine.`,
    ..._createIntroduction(),
  ],
  vocabulary: _createBaseVocabulary(),
  definitions: {},
  symbols: {},
  deprecatedNames: {
    scopeChildren: "children",
    fallbackLens: "loadingLens",
    delayedLens: "loadingLens",
    failedLens: "rejectedLens",
    pendingConnectionsLens: "pendingChroniclesLens",
    failedConnectionsLens: "rejectedChroniclesLens",
    pendingPropsLens: "pendingAttributesLens",
    kueryingPropsLens: "pendingAttributesLens",
    failedPropsLens: "rejectedAttributesLens",
    pendingActivationLens: "pendingFocusLens",
    failedActivationLens: "rejectedFocusLens",
    pendingChildrenLens: "pendingElementsLens",
    failedChildrenLens: "rejectedElementsLens",
    pendingMediaInterpretationLens: "pendingMediaLens",
    failedMediaInterpretationLens: "rejectedMediaLens",
    mediaInterpretationErrorLens: "uninterpretableMediaLens",
    unrenderableMediaInterpretationLens: "unrenderableInterpretationLens",
  },
  processTags (name, tags, definitionDomain) {
    const labels = [];
    const componentType = tags.includes("Valoscope") ? "Lens:Valoscope"
        : tags.includes("Attribute") ? "Lens:Element"
        : null;
    if (componentType) {
      definitionDomain.push(componentType);
      labels.push([`Lens:${name}`, `Lens:${name}`]);
    }
    if (tags.includes("Context")) {
      definitionDomain.push("Lens:UIContext");
      labels.push([`context[$Lens.${name}]`, `$Lens.${name}`]);
    }
    if (!componentType && tags.includes("Lens")) {
      labels.push([`Lens:${name}`]);
    }
    return labels;
  },
  tag,
};

Object.defineProperty(module.exports, "__esModule", { value: true });
module.exports.default = _createSymbols();

function _createIntroduction () {
  return [
`Roughly speaking the Lens namespace terms are:`,
    { "bulleted#1": [
[`used by the Inspire engine to identify an attribute value given to
  a UI element by the valonaut. Engine then uses this to either display
  and customize the UI behavior or to invoke callbacks written by the
  valonaut.`],
[`used by the valonaut to instruct an UI element to use an value or
  default implementation that is provided by the inspire engine and
  is identified by the term.`],
    ] }, `

The 'Lens' terms are marked with tags which describe their qualities.
There are three primary tags:`,
    { "bulleted#2": [
[ref(tag("Attribute"), "#Attribute"), ` tagged terms identify an `,
  ref("element attribute", "Lens:element_attributes"),
  `. These attributes affect only the element itself.`],
[ref(tag("Context"), "#Context"), ` tagged terms identify a `,
  ref(em("context variable"), "Lens:context_variables"),
  `. Context variables of an element affect all of its child elements.`],
[ref(tag("Lens"), "Lens:lens_terms"), ` denotes a term that
  can be used in VSX element bodies to display content`],
    ] },
tag("Lens", "-terms"), ` which are also tagged with either `, tag("Attribute"),
` or `, tag("Context"), ` are known as `, ref("lens slots", "Lens:lens_slots"),
`.

There are also auxiliary tags:`,
    { "bulleted#3": [
[`'Primary' denotes the most commonly used terms`],
[`'Internal' denotes a term that is not intended to be used directly
  from valospace but has relevant internal semantics and is thus
  documented.`],
    ] },
  ];
}

function _createBaseVocabulary () {
  return {
    Node: { "@type": "VEngine:Class",
      "rdfs:comment":
`The class of UI resources which represent a user interface building
block.`,
      "VRevdoc:introduction": [
`This class roughly corresponds to `,
ref("DOM Node interface", "https://developer.mozilla.org/en-US/docs/Web/API/Node"),
`. However as @valos/inspire uses a shadow DOM this correspondence does
not imply prototypical inheritance for any valospace classes.`
      ],
    },
    Element: { "@type": "VEngine:Class",
      "rdfs:subClassOf": "Lens:Node",
      "rdfs:comment":
`The class of UI resources which represent any user interface element.`,
    },
    DOMElement: { "@type": "VEngine:Class",
    "rdfs:label": [vsx(["<", em("lowercase-html-element-name"), " />"])],
    "rdfs:subClassOf": "Lens:Element",
      "rdfs:comment":
`The class of UI resources which represent DOM elements.`,
    },
    Component: { "@type": "VEngine:Class",
      "rdfs:subClassOf": "Lens:Element",
      "rdfs:comment":
`The class of UI resources which represent @valos/inspire user
interface components.`,
    },
    Valoscope: { "@type": "VEngine:Class",
      "rdfs:label": [vsx("<Valoscope />")],
      "rdfs:subClassOf": "Lens:Component",
      "rdfs:comment":
`The class of valos UI components that interact with valospace resources.`,
      "VRevdoc:introduction": [
`The `, em("Lens:"), `-prefix can be omitted for Valoscope attributes`,
      ],
    },
    InstanceComponent: { "@type": "VEngine:Class",
    "rdfs:label": [vsx(["<", em("Uppercase-frame-prototype-identifier"), " />"])],
    "rdfs:subClassOf": "Lens:Valoscope",
      "rdfs:comment":
`The class of valos UI components which instantiate their frame from a
valospace resource.`,
      "VRevdoc:introduction": [
`The `, em("Frame:"), `-prefix can be omitted for InstanceComponent
attributes, whereas `, em("Lens:"), `-prefix must be specified.`,
      ],
    },
    UIContext: { "@type": "VEngine:Class",
      "rdfs:subClassOf": "rdfs:Class",
      "rdfs:comment":
`The class of resource which represent in-memory context variable
scopes.`,
      "VRevdoc:introduction": [
`intended for persistent UI key-value associations that apply to all
nested components.`,
      ],
    },
  };
}

function _createSymbols () {
  const ret = module.exports.symbols;

  function _defineName (name: string, createLensParameters: Object) {
    return defineName(name, module.exports, createLensParameters, { slotName: true });
  }

  const _lensMessageLoadingProps = {
    key: "lp",
    className: `inspire__lensMessage inspire__lensMessage_loading`,
  };
  const _lensMessageLoadingFailedProps = {
    key: "lfp",
    className: `inspire__lensMessage inspire__lensMessage_loadingFailed`,
  };
  const _lensMessageInternalFailureProps = {
    key: "ifp",
    className: `inspire__lensMessage inspire__lensMessage_internalFailure`,
  };
  const _element = "inspire__lensMessage-infoRow";
  const _message = { key: "msg", className: `${_element} ${_element}_message` };
  const _parameter = { key: "p0", className: `${_element} ${_element}_parameter` };
  const _lensChain = { key: "elc", className: `${_element} ${_element}_lensChain` };
  const _component = { key: "ec", className: `${_element} ${_element}_component` };
  const _key = { key: "i-k", className: `inspire__lensMessage-infoKey` };
  const _value = { key: "i-v", className: `inspire__lensMessage-infoValue` };

  ret.instrument = denoteValOSCallable([
`Return an _instrument lens_ which chains multiple sub-lenses in sequence.`,
`When the instrument lens is used to view a focus it is first
set as the focus subLens1. The results shown by subLens1 is then set as
the focus of subLens2 and so on until the final results of the last
lens are shown as the output of the instrument lens itself.`,
  // eslint-disable-next-line
  ])(function instrument (...lenses) {
    return (focus: any, component, lensName: string) => {
      try {
        return lenses.reduce((refraction, lens) =>
            component.renderLens(lens, refraction, lensName, undefined, true), focus);
      } catch (error) {
        throw wrapError(error, `During ${component.debugId()}\n .instrument(), with:`,
            "\n\tlenses:", ...dumpObject(lenses),
            "\n\tfocus:", ...dumpObject(focus),
            "\n\tlensName:", lensName);
      }
    };
  });

  // Primary slots

  _defineName("focus", () => ({
    tags: ["Primary", "Attribute", "Lens"],
    type: "any",
    description: [
`Attribute slot which contains the main content that is displayed by
the component.`,
null,
`The focus can be any value but is often a valospace resource. There is
a lot of semantic sugar for focus resources to support valospace
integration.`,
null,
`This is the value that most other lenses will be inspecting when
displaying their content.`,
null,
`Semantically the concept 'focus' corresponds to the model of the
model-view-controller design pattern. The concept 'lens' corresponds to
'view', and the various components roughly correspond to 'controller'.`,
    ],
  }));

  _defineName("array", () => ({
    tags: ["Primary", "Attribute"],
    type: "any[] | null",
    description: [
`Attribute slot which contains a sequence of focus values or resources
that should are displayed using an 'array spread' duplicates of this
element.`,
null,
`Once the focused array and all the attributes of the component are
activated and live tracked the component is spread as in-place
duplicates. One duplicate component is created for each entry and the
entry value is set as the 'focus' attribute for the duplicate.`,
null,
`If there are no array entries then the component is removed for view
altogether.`,
null,
`If the attributes have any side-effects they are always evaluated once
per update irrespective of the array length (even if 0).`,
    ],
  }));

  _defineName("frame", () => ({
    tags: ["Primary", "Valoscope", "Attribute"],
    type: "string | (focus: string, index: ?number, keyPrefix: ?string) => string",
    description: [
`Attribute slot which is used to compute a frame key string for the
element that is used to identify its frame resource.`,
null,
`In trivial cases the frame key is the frame attribute string value
directly.`,
null,
`The frame key is relative to the closest containing parent frame and
thus does not need to be globally unique.`,
null,
`The frame key is made part of the id of a frame resource if an element
has one. If so a 'frame key property' with name equal to the frame
attribute value is added to the containing frame and is set to point to
this element frame.
Note that the frame key property will not be added for frames without
a static string frame attribute.`,
null,
`If two child elements within the same parent frame are explicitly
constructed to have the same frame key then they will share the same
frame resource as well.`,
null,
`The frame attribute can also be a callback. It is called with an active
focus as its first argument and the return value is then used as the
frame key of the element. This allows the frame key to be computed
based on arbitrary focus contents.`,
null,
`If an element with frame attribute also contains a Lens:array attribute
then the frame attribute value is used to determine the frame key of
each array entry element that results from the array spread. If the
frame attribute is a callback then the position of the element in the
spread is given as the second argument.`,
null,
`If an element with a frame attribute does not have a frame then instead
of using the key as frame key it is set as the current 'keyPrefix'
which then applies to all nested children of that element. If a current
keyPrefix exists, the key is appended to it using "_" as separator.
A frame key of an element with non-empty keyPrefix is computed by
appending the child element key attribute string to the keyPrefix; the
keyPrefix is then cleared for its nested children.`,
null,
`If a frame attribute is a callback then the current keyPrefix is given
as a third argument and the returned value is set as the frame key if
the element has a frame. Otherwise the returned value replaces the
current keyPrefix for the nested children of that element.`,
null,
`Last but not least: if the frame attribute of an array spread is a
string then all array entries will share the same frame. This allows
for array elements with differing focus to easily share state.
To prevent accidental nested frame key conflicts the position of each
entry is then added as the initial keyPrefix for the children of that
entry.`,
null,
`Note: this is in fact the only way for array entries to share a frame
directly. Array spread frame callback functions must always return
unique frame keys.`
    ],
  }));

  _defineName("lens", () => ({
    tags: ["Primary", "Valoscope", "Attribute", "Lens"],
    type: "Lens",
    description: [
`Attribute slot for displaying the valid focus of a fully loaded component.`,
null,
`If $Lens.lens is specified as an attribute for a non-valoscope element
then the element will be wrapped inside an implicit Valoscope
(including a new frame).`,
null,
`This slot can only be provided as a component attribute and is checked
only after focus and all other attributes are activated and only if the
focus is valid. The focus is valid if it is not a resource or if it is
an active Resource (ie. not unavailable or destroyed).`,
null,
`Semantically the concept 'lens' corresponds to the view of the
model-view-controller design pattern. The concept 'focus' corresponds
to 'model', and the various components roughly correspond to 'controller'.

    @focus {Object} focus  the focus of the component.`,
    ],
    isEnabled: true,
  }));

  const loadingLens = _defineName("loadingLens", () => ({
    tags: ["Primary", "Attribute", "Context", "Lens", "Loading"],
    type: "Lens",
    description: [
`A catch-all slot for displaying a description of a dependency which is
still being loaded.`,
null,
`This slot has no default lens.
If a lens is placed into this slot then all the other loading slots
will by default delegate displaying to that lens instead of using their
own default lens.

    @focus {Object} component  an object description of the dependency being loaded`,
    ],
  }));

  const loadingFailedLens = _defineName("loadingFailedLens", () => ({
    tags: ["Primary", "Attribute", "Context", "Lens", "Loading", "Failure"],
    type: "Lens",
    description: [
`A catch-all slot for displaying a description of a dependency which has
failed to load.`,
null,
`This slot has no default lens.
If a lens is placed into this slot then all the other loading failure
slots will by default delegate displaying to that lens instead of using
their own default lens.

    @focus {string|Error|Object} reason  the explanation of the loading failure`,
    ],
  }));

  // View control slots

  _defineName("if", () => ({
    tags: ["Attribute", "Lens"],
    type: "any | (focus) => boolean",
    description: [
`Attribute slot which contains a condition on whether to view the focus
using this component.`,
null,
`If the slot contains a callback it is called with 'focus' as the first
argument and the return value is used as the condition. Otherwise the
slot  value is used directly.`,
null,
`If the condition is truthy the focus is displayed with lens from slot
'then' (which by default renders the rest of the component normally).
If the condition is falsy the focus is displayed using lens from slot
'else' which presents null.`,
    ],
    isEnabled (focus: any, component) {
      if (!component.props.hasOwnProperty("if")) return false;
      let condition = component.props.if;
      if (component.props.then !== undefined) return true;
      if (typeof condition === "function") {
        condition = condition(focus);
      }
      return !condition; // if falsy condition, enable lens
    },
    value (focus: any, component) {
      // if then is undefined we only get here if condition is falsy.
      const then_ = component.props.then;
      if (then_ !== undefined) {
        let condition = component.props.if;
        if (typeof condition === "function") condition = condition(focus);
        if (condition) return then_;
      }
      const else_ = component.props.else;
      return else_ === undefined ? [] : else_;
    },
  }));

  _defineName("then", () => ({
    tags: ["Attribute", "Lens"],
    type: "Lens",
    description: [
`Attribute slot with which to view the focus after a truthy condition
check.`,
null,
`By default delegates displaying to the Valoscope lens chain.`,
    ]
  }));

  _defineName("else", () => ({
    tags: ["Attribute", "Lens"],
    type: "Lens",
    description: [
`Attribute slot with which to view the focus after a falsy condition
check.`,
null,
`By default displays null.`,
    ]
  }));

  _defineName("offset", () => ({
    tags: ["Attribute"],
    type: "number | null",
    description: [
`Offset to the first source array entry to begin spreading elements
from.`,
    ],
  }));

  _defineName("limit", () => ({
    tags: ["Attribute"],
    type: "number | null",
    description: [
`Maximum number of elements to spread out at once.`,
null,
`This limit is applied after the offset and filtering (see $Lens.if)
but before sorting (see $Lens.sort).`,
    ],
  }));

  _defineName("arrayIndex", () => ({
    tags: ["Context"],
    type: "number | null",
    description: [
`Context slot which contains the source array index of the nearest
containing entry element within an array element spread, or null if
there is none.`,
null,
`This is the location of the element focus in the $Lens.array before any
filtering and sorting. By default $Lens.arrayIndex is also used as part
of the implicit frame key generation (see $Lens.frame).`,
    ],
  }));

  _defineName("endOffset", () => ({
    tags: ["Context"],
    type: "number | null",
    description: [
`The offset to the first source array entry that is not visible after
$Lens.limit has been met.`,
    ],
  }));

  _defineName("elementIndex", () => ({
    tags: ["Context"],
    type: "number | null",
    description: [
`Context slot which contains the final index of the nearest containing
entry element within an array element spread, or null if there is none.`,
null,
`This is the index of the final position of the element after filtering
(see $Lens.if) and sorting (see $Lens.sort).`,
    ],
  }));

  _defineName("sort", () => ({
    tags: ["Attribute"],
    type: "(leftFocus, rightFocus, leftAttributes, rightAttributes) => number | Symbol | null",
    description: [
`The compare function for sorting the array spread elements.`,
null,
`This sort is performed after offset, if-filtering and limits are resolved.
Changes to the sort operation maintains element identities and doesn't
trigger element view refreshes.`,
null,
`Note: if sorting that happens before offsets and filtering is needed
this can be done using regular means, ie. by sorting the expression
that is passed as $Lens.array. This will not maintain identities,
however.`,
    ],
  }));

  _defineName("reverse", () => ({
    tags: ["Attribute"],
    type: "boolean",
    description:
`Reverse the $Lens.sort order.`,
  }));

  // Primitive lenses

  _defineName("children", () => ({
    tags: ["Internal", "Lens"],
    type: "any",
    description: [
`Lens for displaying the focus using the child element(s) of the nearest
surrounding Valoscope component.`,
null,
`The neartest surrounding Valoscope can be an implicit Valoscope such
as an instance lens or one emitted by attributes like $Lens.frame.`,
null,
`Depending on the exact location of where the $Lens.children lens
reference appears (ie. the location inside some text media) there are
three notably different looking use cases.`,
      { "numbered#": [
[`When this lens is used as an attribute value of a valoscope element:
  the reference resolves to the direct lexical child elements of
  the valoscope as they are appear in the media text itself.`],
[`When this lens is used as an element without there being any
  enclosing valoscope elements in the same media text: this reference
  resolves to the lexical children of an external valoscope that is
  using this media as a lens.`],
[`When this lens is used as an element so that there exists an
  enclosing valoscope element in the same media text: this reference
  resolves to the lexical children of that valoscope element just
  like in the first case. However as this includes the reference itself
  this easily results in infinite recursion and should be avoided.`],
      ] },
    ]
  }));

  const componentChildrenLens = _defineName("componentChildrenLens", () => ({
    tags: ["Lens"],
    type: "Lens",
    description: [
`Lens that displays the child elements of the immediate parent component.`,
    ],
    isEnabled (u: any, component) {
      const children = component.props.children;
      return Array.isArray(children) ? children.length : children != null;
    },
    value (focus: any, component) { return component.props.children; },
  }));

  _defineName("static", () => ({
    tags: ["Attribute"],
    type: "boolean",
    description: [
`Lens attribute to declare all component attributes non-live by default.`,
null,
`An attribute can still selectively be made live by prefixing its
namespace with 'live-' (ie. an attribute with implicit namepace must
have its namespace be explicitly given: 'Lens:' for Valoscopes,
'Frame:' for instance lens frame attributes and 'HTML:' for generic
html attributes).`,
null,
`Alternatively this attribute can be omitted and attributes can be
selectively made static by prefixing their namespace with 'static-'
like above.`,
    ],
  }));

  const slotAssembly = _defineName("slotAssembly", () => ({
    tags: ["Lens"],
    type: "string[]",
    description:
`Lens that displays the lens slot assembly that is used by the component.`,
  }));

  const niceActiveSlotNames = ret.instrument(
      slotAssembly,
      slotNames => slotNames.slice(0, -1).reverse().join(" <| "));

  const parentComponentLens = _defineName("parentComponentLens", () => ({
    tags: ["Lens"],
    type: "UIComponent",
    description: [
`Lens that displays the current parent component.`,
null,
`As the component itself
is not renderable this slot must be used in an instrument before some
other slot (such as 'focusDetailLens').`,
    ],
    isEnabled: true,
    value (focus: any, component) { return component; },
  }));

  const focusDescriptionLens = _defineName("focusDescriptionLens", () => ({
    tags: ["Lens"],
    type: "Lens",
    description: [
`Lens that displays an introspective description of the focus.`,
null,
`    @focus {any} focus  the focus to describe.`,
    ],
    isEnabled: true,
    value: function renderFocusDescription (focus: any, component) {
      switch (typeof focus) {
        case "string":
          return `"${focus.length <= 30 ? focus : `${focus.slice(0, 27)}...`}"`;
        case "function":
          return `(${focus.name})`;
        case "object": {
          if (focus !== null) {
            if (focus instanceof Vrapper) return focus.debugId({ short: true });
            if (Array.isArray(focus)) {
              return `[${focus.map(entry => renderFocusDescription(entry, component))
                  .join(", ")}]`;
            }
            return `{ ${Object.keys(focus).join(", ")} }`;
          }
        }
        // eslint-disable-next-line no-fallthrough
        default:
          return JSON.stringify(focus);
      }
    },
  }));

  const focusDetailLens = _defineName("focusDetailLens", () => ({
    tags: ["Lens"],
    type: "Lens",
    description: [
`Lens that displays a detailed, developer-oriented debug introspection of
the focus.`,
null,
`    @focus {any} focus  the focus to describe.`,
    ],
    isEnabled: true,
    value: function renderFocusDetail (focus: any) {
      return debugId(focus);
    }
  }));

  const focusDumpLens = _defineName("focusDumpLens", () => ({
    tags: ["Lens"],
    type: "Lens",
    description: [
`Lens that displays a full string dump of the focus.`,
null,
`Replaces circular/duplicates with tags.

    @focus {any} focus  the focus to dump.`,
    ],
    isEnabled: true,
    value: function renderFocusDump (focus: any) {
      return dumpify(focus, { indent: 2 });
    },
  }));

  _defineName("focusPropertyKeysLens", () => ({
    tags: ["Lens"],
    type: "Lens",
    description: [
`Lens that displays the list of property keys of the focus.`,
null,
`Uses the semantics of Object.keys to construct the list.

    @focus {object | Resource} focus  the focus to describe.`,
    ],
    isEnabled: (focus) => focus && (typeof focus === "object"),
    value: function renderFocusPropertyKeys (focus: any) {
      return (!focus || (typeof focus !== "object")
          ? undefined
          : Object.keys(!(focus instanceof Vrapper) ? focus : focus.getValospaceScope()));
    },
  }));

  const toggleableErrorDetailLens = _defineName("toggleableErrorDetailLens", () => ({
    tags: ["Context", "Lens"],
    type: "Lens",
    description: [
`A catch-all slot for displaying a detailed, toggleable view of the
focused error.`,
null,
`The default lens on this slot renders Show and Hide buttons.

    @focus {string|Error} error  the failure description or exception object`,
    ],
    isEnabled: true,
    defaultValue: function renderToggleableErrorDetail (failure: any, component) {
      return ([
        <button onClick={() => component.toggleError()}>
          {component.state.errorHidden ? "Show" : "Hide"}
        </button>,
        <button onClick={() => component.clearError()}>
          Clear
        </button>,
        component.state.errorHidden ? null : (
          <pre style={{ fontFamily: "monospace" }}>
            {messageFromError(failure)}
          </pre>
        )
      ]);
    },
  }));

  _defineName("internalErrorLens", () => ({
    tags: ["Internal", "Context", "Lens", "Failure", "Error"],
    type: "Lens",
    description: [
`A catch-all Slot for displaying an internal error.`,
null,
`Internal errors are f.ex. unhandled exceptions or a constraint
violation such as 'pendingPromiseLens' resulting in a promise itself.`,
null,
`By default renders the yelling-red screen.`,
null,
`    @focus {string|Error} error  the failure description or exception object`,
    ],
    isEnabled: true,
    defaultValue: function renderInternalFailure () {
      return (
        <div {..._lensMessageInternalFailureProps}>
          Render Error: Component has internal error(s).
          {toggleableErrorDetailLens}
        </div>
      );
    },
  }));

  const currentRenderDepth = _defineName("currentRenderDepth", () => ({
    tags: ["Context", "Lens"],
    type: "number",
    description: [
`Slot which contains the number of ancestor components that exist
between this component and the root (inclusive).`,
null,
`If the value of this slot is explicitly set it is used as the new base
value for all nested child components of this component.`,
    ],
    defaultValue: 0,
  }));

  _defineName("infiniteRecursionCheckWaterlineDepth", () => ({
    tags: ["Context", "Lens"],
    type: "number",
    description: [
`Slot which contains the minimum currentRenderDepth for checking for
infinite render recursion.`,
    ],
    defaultValue: 150,
  }));

  const maximumRenderDepth = _defineName("maximumRenderDepth", () => ({
    tags: ["Context", "Lens"],
    type: "number",
    description: [
`Slot which contains for the maximum allowed value for currentRenderDepth.`,
    ],
    defaultValue: 200,
  }));

  const maximumRenderDepthExceededLens = _defineName("maximumRenderDepthExceededLens", () => ({
    tags: ["Context", "Lens", "Failure"],
    type: "Lens",
    description: [
`Slot for displaying the focus if the slot value of 'currentRenderDepth'
is greater than the slot value of 'maximumRenderDepth'.`,
null,
`    @focus {Object} focus  currently focused value.`,
    ],
    isEnabled: (u, component) =>
      (component.getUIContextValue(currentRenderDepth) >
          component.getUIContextValue(maximumRenderDepth)),
    defaultValue:
      <div {..._lensMessageInternalFailureProps}>
        <div {..._message}>
          $Lens.currentRenderDepth ({currentRenderDepth}) exceeds
          $Lens.meximumRenderDepth ({maximumRenderDepth}).
        </div>
        <div {..._parameter}>
          <span {..._key}>currentRenderDepth:</span>
          <span {..._value}>{currentRenderDepth}</span>
        </div>
        <div key="p1" {..._parameter}>
          <span {..._key}>maximumRenderDepth:</span>
          <span {..._value}>{maximumRenderDepth}</span>
        </div>
        {commonMessageRows}
      </div>,
  }));

  // Valoscope and Valens

  _defineName("valoscopeLens", () => ({
    tags: ["Internal", "Lens"],
    type: "Lens",
    description: [
`Internal lens for showing the focus via the Valoscope lens slot
sequence.`,
null,
`Valoscope is a built-in fabric component which searches the first
enabled lens in the particular sequence of slots (which is defined
below) based on the current dynamic state and/or value of the focus.`,
null,
`    @focus {any} focus  the focus of the component`,
    ],
    isEnabled: true,
    value: ({ delegate: Object.freeze([
      ret.firstEnabledDelegateLens,
      ret.if,
      ret.disabledLens,
      ret.unframedLens,
      maximumRenderDepthExceededLens,
      ret.instanceLens,
      ret.undefinedLens,
      ret.lens,
      ret.nullLens,
      componentChildrenLens,
      ret.resourceLens,
      ret.loadedLens,
    ]) }),
  }));

  _defineName("valensLens", () => ({
    tags: ["Internal", "Lens"],
    type: "Lens",
    description: [
`Internal lens for displaying the focus via the Valens lens slot sequence.`,
null,
`Valens is a built-in fabric component which wraps a UI component
and subscribes to sourcerer event updates that affect the props of that
component. It then triggers the dynamic update of the wrapped UI
component in response to such events.`,
null,
`    @focus {any} focus  the focus of the component`,
    ],
    isEnabled: true,
    value: ({ delegate: Object.freeze([
      ret.firstEnabledDelegateLens,
      ret.disabledLens,
      ret.undefinedLens,
      ret.loadedLens,
    ]) }),
  }));

  _defineName("uiComponentLens", () => ({
    tags: ["Internal", "Lens"],
    type: "Lens",
    description: [
`Internal lens for displaying the focus via the UIComponent lens slot
sequence.`,
null,
`UIComponent is a built-in fabric component base class which is
responsible for connecting the lens system into the underlying React
implementation.`,
null,
`    @focus {string|Error|Object} focus  the focus of the component`,
    ],
    isEnabled: true,
    value: ({ delegate: [
      ret.firstEnabledDelegateLens,
      ret.disabledLens,
      ret.undefinedLens,
      ret.loadedLens,
    ] }),
  }));


  _defineName("firstEnabledDelegateLens", () => ({
    tags: ["Internal", "Lens"],
    type: "Lens",
    description: [
`Internal lens for displaying the focus via the first enabled lens listed
in the $Lens.delegate of the current fabric component.`,
null,
`    @focus {string|Error|Object} focus  the focus of the component`,
    ],
    isEnabled: (u, component) => (component.props.delegate !== undefined),
    value: function renderFirstEnabledDelegate (focus, component, lensName = "delegate") {
      return component.renderFirstEnabledDelegate(component.props.delegate, focus, lensName);
    }
  }));

  _defineName("loadedLens", () => ({
    tags: ["Internal", "Lens"],
    type: "Lens",
    description: [
`Internal lens for displaying the focus by calling the .renderLoaded
fabric method of the current component.`,
null,
`    @focus {string|Error|Object} focus  the focus of the component`,
    ],
    isEnabled: true,
    value: function renderLoaded (focus, component) {
      return component.renderLoaded(focus);
    },
  }));

  // Content lenses

  _defineName("undefinedLens", () => ({
    tags: ["Attribute", "Context", "Lens"],
    type: "Lens",
    description: [
`Slot for displaying an undefined focus.`,
    ],
    isEnabled: (focus) => (focus === undefined),
    defaultValue: ({ delegate: [
      ret.instrument(
          (u, component) => (component.props.focus),
          ret.pendingFocusLens),
    ] }),
  }));

  _defineName("nullLens", () => ({
    tags: ["Attribute", "Context", "Lens"],
    type: "Lens",
    description: [
`Slot for displaying a null focus.`,
    ],
    isEnabled: (focus) => (focus === null),
    defaultValue: "",
  }));

  _defineName("resourceLens", () => ({
    tags: ["Attribute", "Context", "Lens"],
    type: "Lens",
    description: [
`Slot for displaying the focused Resource based on its activation phase.`,
null,
`The default lens delegates the displaying to a lens slot based on whether
the focus is is inactive, activating, active, destroyer or unavailable.`,
null,
`Note: This lens slot will initiate the activation of the focus!`,
null,
`    @focus {Resource} focus  the Resource focus.`,
    ],
    // TODO(iridian, 2019-03): Is this actually correct? Semantically
    // activating the lens inside isEnabled is fishy.
    // Maybe this was intended to be refreshPhase instead?
    isEnabled: (focus?: Vrapper) => (focus instanceof Vrapper) && focus.activate(),
    defaultValue: ({ delegate: [
      ret.activeLens,
      ret.activatingLens,
      ret.inactiveLens,
      ret.destroyedLens,
      ret.unavailableLens,
    ] }),
  }));

  _defineName("activeLens", () => ({
    tags: ["Attribute", "Context", "Lens"],
    type: "Lens",
    description: [
`Slot for displaying an active focused Resource.`,
null,
`The default lens delegates showing to focusPropertyLens.`,
null,
`    @focus {Object} focus  the active Resource focus.`,
    ],
    isEnabled: (focus?: Vrapper) => focus && focus.isActive(),
    defaultValue: ret.focusPropertyLens,
  }));

  _defineName("lensProperty", () => ({
    tags: ["Valoscope", "Attribute", "Context"],
    type: "(string | string[])",
    description: [
`Slot which contains the property name (or an array of names) that is
looked up from a focused Resource for displaying the Resource itself.`,
null,
`This slot is used by all lens property lenses as the default fallback
property name.`,
null,
`If $Lens.lensProperty is specified as an attribute for a non-valoscope
element then the element will be wrapped inside an implicit Valoscope
(including a new frame).`,
    ],
  }));

  _createLensPropertySlots("focusLensProperty", ["FOCUS_LENS"],
      "focusPropertyLens", "lensPropertyNotFoundLens");
  _createLensPropertySlots("delegateLensProperty", ["DELEGATE_LENS"],
      "delegatePropertyLens", "notLensResourceLens");

  function _createLensPropertySlots (specificLensPropertySlotName, defaultValueProperties,
      propertyLensName, notFoundName) {
    const slotSymbol = _defineName(specificLensPropertySlotName, () => ({
      tags: ["Valoscope", "Attribute", "Context"],
      type: "(string | string[])",
      description: [
`Slot which contains the property name that is searched from the
Resource focus when resolving the *${propertyLensName}* lens.`,
null,
`Can be an array of property names in which case they are searched in
order and the first property with not-undefined value is selected.`,
null,
`If $Lens.${specificLensPropertySlotName} is specified as an attribute
for a non-valoscope element then the element will be wrapped inside an
implicit Valoscope (including a new frame).`,
      ],
      isEnabled: undefined,
      defaultValue: defaultValueProperties,
    }));

    _defineName(propertyLensName, () => ({
      tags: ["Internal", "Lens"],
      type: "Lens",
      description: [
`Internal slot for displaying the focused Resource via a *property lens*
read from the focus Resource itself.`,
null,
`By default searches the focused Resource for a specific lens property
named in slot '${specificLensPropertySlotName}'.`,
null,
`If no specific lens property is found then the generic lens property
name which is defined in slot 'lensProperty' is searched.`,
null,
`If a property name slot contains an array of strings then these are
searched in the order they are defined from the focus Resource.`,
null,
`If still no suitable lens can be found delegates the displaying to '${notFoundName || "null"}'.`,
null,
`    @focus {Object} focus  the Resource to search the lens from.`,
      ],
      isEnabled: (focus?: Vrapper) => focus && focus.hasInterface("Scope"),
      value: function getLensProperty (focus: any, component, /* currentSlotName: string */) {
        /*
        if (component.props.lensName) {
          console.warn("DEPRECATED: props.lensName\n\tprefer: props.lensProperty",
              "\n\tlensName:", JSON.stringify(component.props.lensName),
              "\n\tin component:", component.debugId(), component);
        }
        */
        const scope = focus.tryValospaceScope();
        const options = { scope };
        const specificNames = component.props[specificLensPropertySlotName]
            || component.getUIContextValue(slotSymbol);
        const specificLensValue = specificNames ? _lookupPropertyBy(specificNames) : undefined;
        if (specificLensValue !== undefined) return specificLensValue;

        const genericNames = component.props.lensProperty
            || component.getUIContextValue(ret.lensProperty);
        const genericLensValue = genericNames ? _lookupPropertyBy(genericNames) : undefined;
        if (genericLensValue !== undefined) return genericLensValue;
        /*
        console.error("Can't find resource lens props:", specificLensPropertySlotName, slotSymbol,
            "\n\tnotFoundName:", notFoundName, ret[notFoundName],
            "\n\tcomponent:", component,
            "\n\tfocus:", focus);
        */

        if (!notFoundName) return null;
        return { delegate: [ret[notFoundName]] };

        function _lookupPropertyBy (propertyNames) {
          if (!Array.isArray(propertyNames)) {
            return (scope && scope.hasOwnProperty(propertyNames))
                ? scope[propertyNames]
                : focus.step(Vrapper.getPropertyKuery(propertyNames), options);
          }
          for (const name of propertyNames) {
            const vProperty = (scope && scope.hasOwnProperty(name))
                ? scope[name]
                : focus.step(Vrapper.getPropertyKuery(name), options);
            if (vProperty !== undefined) return vProperty;
          }
          return undefined;
        }
      },
    }));
  }

  // Instance lenses

  _defineName("unframedLens", () => ({
    tags: ["Attribute", "Context", "Lens"],
    type: "Lens",
    description:
`Slot for displaying a Valoscope which has not yet loaded its lens frame.`,
    isEnabled: (focus, component) => !component.state || (component.state.scopeFrame === undefined),
    defaultValue: function renderUnframed () {
      return "<Loading frame...>";
    },
  }));

  _defineName("instanceLensPrototype", () => ({
    tags: ["Valoscope", "Attribute"],
    type: "Resource",
    description: [
`Attribute slot for an instance lens frame prototype resource.`,
null,
`If $Lens.instanceLensPrototype is specified as an attribute for a
non-valoscope element then the element will be wrapped inside an
implicit Valoscope which handles the frame creation.`,
    ],
  }));

  _defineName("instanceLens", () => ({
    tags: ["Internal", "Lens"],
    type: "Lens",
    description: [
`Internal slot for displaying the focus through an instance Valoscope (ie.
one which has the attribute 'instanceLensPrototype' defined).`,
null,
`Awaits for the scopeFrame promise to resolve and then searches the
the focus for instance lens property and if found delegates the displaying
to it. If no instance lens property is found from the focus then
delegates the displaying to the lens(es) specified by the scopeFrame
instance prototype.`,
    ],
    isEnabled: (focus, component) => component.props.instanceLensPrototype,
    value: function renderInstance (focus, component, currentSlotName) {
      return thenChainEagerly(
          component.state.scopeFrame, [
            (scopeFrame => {
              if ((scopeFrame == null) || !(scopeFrame instanceof Vrapper)) return "";
              if (!scopeFrame.hasInterface("Scope")) return scopeFrame;
              const instanceSlotName = `instance-${currentSlotName}`;
              const instanceLens = component.getUIContextValue(ret.instancePropertyLens)(
                  scopeFrame, component, instanceSlotName);
              return (instanceLens != null) ? instanceLens : scopeFrame;
            }),
          ]);
    },
  }));

  _createLensPropertySlots("instanceLensProperty", ["INSTANCE_LENS"], "instancePropertyLens",
      "mediaInstanceLens");

  _defineName("mediaInstanceLens", () => ({
    tags: ["Internal", "Lens"],
    type: "Lens",
    description: [
`Internal slot for displaying an instance lens of a Media which doesn't
specify a lens property at all.`,
null,
`    @focus {Object} focus  the active Resource focus.`,
    ],
    isEnabled: (focus, component) =>
        (component.props.instanceLensPrototype.getTypeName() === "Media"),
    value: function renderMediaInstance (focus, component) {
      return component.props.instanceLensPrototype;
    },
  }));

  _defineName("scopeFrameResource", () => ({
    tags: ["Internal", "Context"],
    type: "Resource",
    description: [
`Slot which contains the current innermost enclosing scope frame that
is also a Resource.`,
null,
`Any scope frames that are created by the child components of the
current component will use this scope frame resource as their owner.`,
    ],
  }));

  _defineName("frameStepPrefix", () => ({
    tags: ["Internal", "Context"],
    type: "string",
    description: [
`Slot which contains the frame vpath step prefix from the current
innermost enclosing scope frame.`,
    ],
  }));

  _defineName("frameOwner", () => ({
    tags: ["Attribute"],
    type: "(string | null)",
    description: [
`Attribute slot which contains an explicit owner for a frame resource
or null.`,
null,
`Null owner is only allowed for frame chronicle roots.`,
null,
`Setting the owner explicitly has the a consequence that the frame id
of the element becomes dependent of the new owner, detaching the frame
id of the dynamic UI element hierarchy.`,
null,
`Setting owner to null makes the frame id to behave like a global
identifier, so that elements with the same frame id will share the
same frame across the application. With implicit frame keys this can
cause unintended ambiguities as the frame key is still computed
relative the current parent frame.`,
    ],
  }));

  _defineName("frameAuthority", () => ({
    tags: ["Attribute", "Context"],
    type: "(string | null)",
    description: [
`Slot which contains a frame authority URI which is used for creating
new frame chronicles.`,
null,
`If a frameAuthority attribute slot is set this will trigger the
creation of a new frame chronicle, using the element frame as its root
resource. If the attribute slot is set to null no new frame chronicle
is  created irrespective of other configurations; the frame is placed
inside the current frame chronicle as normal.`,
null,
`Conversely the frameAuthority context slot is read and used for a new
frame chronicle when no explicit frame authority can be found. This
most typically happens if the focused resource belongs to a different
chronicle than the current frame chronicle root focus resource (which
is stored in 'frameRootFocus'). If the context slot value is null then
this implicit chronicle creation is disabled.`,
    ],
    isEnabled: undefined,
    defaultValue: "valaa-memory:",
  }));

  _defineName("frameAuthorityProperty", () => ({
    tags: ["Context"],
    type: "(string)",
    description: [
`Slot which contains the _property name_ that is used when searching a
resource for an authority URI string.`,
null,
`This property will be searched for from a lens instance prototype or
a Resource focus when obtaining a lens frame.`,
null,
`If found the authority URI will be used for the lens chronicle.
If the chronicle didn't already exist new lens chronicle is created in
that authority URI with a new scope frame resource as its chronicle
root.`,
    ],
    isEnabled: undefined,
    defaultValue: ["FRAME_AUTHORITY", "LENS_AUTHORITY"],
  }));

  _defineName("frameRoot", () => ({
    tags: ["Internal", "Context"],
    type: "(Resource | null)",
    description: [
`Slot which contains root resource of the current frame chronicle.`,
null,
`This root resource is a frame of some element that was set up to create
a new chronicle for its frame. This can happen either explicitly via
an attribute or a property field on instance prototype or focus, or
implicitly when a focused resource is a root of a regular chronicle
(such that is different from the current frameRootFocus chronicle).
Such a focused resource is stored in slot 'frameRootFocus'.`,
    ],
  }));

  _defineName("frameRootFocus", () => ({
    tags: ["Internal", "Context"],
    type: "(Resource | null)",
    description: [
`Slot which contains the resource that is the focus of the element
which created the current frame chronicle.`,
null,
`The root of the frame chronicle is stored in the slot 'frameRoot'.`,
null,
`This slot is primarily used to prevent
the creation of new frame chronicles for each sub-element that focus
the same regular chronicle root resource.`,
    ],
  }));

  _defineName("integrationScopeResource", () => ({
    tags: ["Context"],
    type: "Resource",
    description: [
`Slot which contains the integration scope resource of the innermost
Media that is used as source for render elements.`,
    ],
  }));

  // Main component lens sequence and failure lenses

  const commonMessageRows = [
    <div {..._lensChain}>
      <span {..._key}>Lens slot delegation:</span>
      <span {..._value}>{niceActiveSlotNames}</span>
    </div>,
    <div {..._component}>
      <span {..._key}>Containing component:</span>
      <span {..._value}>
        {ret.instrument(parentComponentLens, focusDetailLens)}
      </span>
    </div>,
  ];

  _defineName("disabledLens", () => ({
    tags: ["Internal", "Context", "Lens", "Loading", "Failure"],
    type: "Lens",
    description: [
`Slot for displaying an explicitly disabled component.`,
null,
`    @focus {string|Error|Object} reason  a description of why the component is disabled.`,
    ],
    isEnabled: (u, component) => ((component.state || {}).uiContext === undefined),
    defaultValue: ({ delegate: [
      loadingFailedLens,
      <div {..._lensMessageLoadingFailedProps}>
        <div {..._message}>Component is disabled; focus and context are not available.</div>
        <div {..._parameter}>
          <span {..._key}>Disable reason:</span>
          <span {..._value}>{focusDetailLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  const pendingLens = _defineName("pendingLens", () => ({
    tags: ["Primary", "Attribute", "Context", "Lens", "Loading"],
    type: "Lens",
    description: [
`A catch-all slot for displaying a description of a pending operation.`,
null,
`This slot delegates to loadingLens but has no default lens.
If a lens is placed into this slot then all the other pending slots
will by default delegate displaying to that lens instead of using their
own default lens.`,
null,
`    @focus {Object} component  an object description of the dependency being loaded`,
    ],
    defaultValue: loadingLens,
  }));

  const rejectedLens = _defineName("rejectedLens", () => ({
    tags: ["Primary", "Attribute", "Context", "Lens", "Loading", "Failure"],
    type: "Lens",
    description: [
`A catch-all slot for displaying a pending operation which was rejected.`,
null,
`This slot has no default lens.`,
null,
`If a lens is placed into this slot then all the other rejection slots
will by default delegate displaying to that lens instead of using their
own default lens.`,
null,
`    @focus {Error} reason  the pending operation rejection error`,
    ],
    defaultValue: loadingFailedLens,
  }));

  _defineName("pendingPromiseLens", () => ({
    tags: ["Attribute", "Context", "Lens", "Loading"],
    type: "Lens",
    description: [
`Slot for displaying a description of a generic dependency which is a
pending promise.`,
null,
`If the lens placed to this slot returns a promise then
'internalErrorLens' is displayed instead.`,
null,
`    @focus {Object} dependency  a description object of the pending dependency.`,
    ],
    isEnabled: true,
    defaultValue: ({ delegate: [
      pendingLens,
      <div {..._lensMessageLoadingProps}>
        <div {..._message}>Waiting for a pending operation to resolve.</div>
        <div {..._parameter}>
          <span {..._key}>Dependency:</span>
          <span {..._value}>{focusDetailLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _defineName("rejectedPromiseLens", () => ({
    tags: ["Attribute", "Context", "Lens", "Loading", "Failure", "Error"],
    type: "Lens",
    description: [
`Slot for displaying a generic pending operation rejection error.`,
null,
`    @focus {Error} reason  operation rejection error.`,
    ],
    isEnabled: true,
    defaultValue: ({ delegate: [
      rejectedLens,
      <div {..._lensMessageInternalFailureProps}>
        <div {..._message}>
          Render Error: Lens Promise failed.
          {toggleableErrorDetailLens}
        </div>
        <div {..._parameter}>
          <span {..._key}>Lens:</span>
          <span {..._value}>
            {ret.instrument(error => error.lens, focusDetailLens)}
          </span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _defineName("pendingChroniclesLens", () => ({
    tags: ["Attribute", "Context", "Lens", "Loading"],
    type: "Lens",
    description: [
`Slot for displaying descriptions of the chronicles that are being sourcered.`,
null,
`    @focus {Object[]} chronicles  the chronicles that are being sourcered.`,
    ],
    isEnabled: true,
    defaultValue: ({ delegate: [
      pendingLens,
      <div {..._lensMessageLoadingProps}>
        <div {..._message}>Acquiring chronicle connection(s).</div>
        <div {..._parameter}>
          <span {..._key}>Chronicles:</span>
          <span {..._value}>{focusDescriptionLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _defineName("rejectedChroniclesLens", () => ({
    tags: ["Attribute", "Context", "Lens", "Loading", "Failure", "Error"],
    type: "Lens",
    description: [
`Slot for displaying chronicle sourcery failure(s).`,
null,
`    @focus {Error} reason  a chronicle sourcery rejection error.`,
    ],
    isEnabled: true,
    defaultValue: ({ delegate: [
      rejectedLens,
      <div {..._lensMessageInternalFailureProps}>
        <div {..._message}>
          Render Error: Optimistic Chronicle connection failed.
          {toggleableErrorDetailLens}
        </div>
        <div {..._parameter}>
          <span {..._key}>Chronicle:</span>
          <span {..._value}>
            {ret.instrument(error => error.resource, focusDescriptionLens)}
          </span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _defineName("delayed", () => ({
    tags: ["Attribute"],
    type: "boolean | Symbol[]",
    description: [
`Trigger asynchronous displaying for the component by surrounding its
internal rendering stages inside promises.`,
null,
`By default inspire will render all components synchronously. This is
to avoid needlessly displaying loading lenses that would only be
very briefly available and also for slight performance benefits.
Occasionaly computing large datasets will take a long time to compute.`,
null,
`Making a component delayed will surround the individual rendering stages
of the component inside promises to improve responsiveness.
Each stage is identified by their pending lens slot which they will
also display when they are pending:`,
      { "numbered#": [
[`$Lens.pendingAttributesLens during the attribute resolution stage`],
[`$Lens.pendingFocusLens during the focus activation stage`],
[`$Lens.pendingFrameLens during the frame resolution stage (for Valoscope components)`],
[`$Lens.pendingMediaLens during the main lens media interpretation stage (ie. not for elements)`],
[`$Lens.pendingElementsLens during the final element rendering stage`],
      ] },
`Optionally, the delayed attribute can be given an array of only some of
the above pending slot names to make selectively delayed.`,
    ],
  }));

  _defineName("pendingAttributesLens", () => ({
    tags: ["Context", "Lens", "Loading"],
    type: "Lens",
    description: [
`Slot for displaying the description of attributes which are pending resolution.`,
null,
`    @focus {Object} props  the pending attributes.`,
    ],
    isEnabled: true,
    defaultValue: ({ delegate: [
      pendingLens,
      <div {..._lensMessageLoadingProps}>
        <div {..._message}>Waiting for pending attributes to resolve.</div>
        <div {..._parameter}>
          <span {..._key}>Attributes:</span>
          <span {..._value}>{focusDetailLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _defineName("rejectedAttributesLens", () => ({
    tags: ["Context", "Lens", "Loading", "Failure", "Error"],
    type: "Lens",
    description: [
`Slot for displaying an attribute loading rejection error.`,
null,
`    @focus {string|Error|Object} reason  attribute rejection error.`,
    ],
    isEnabled: true,
    // TODO(iridian, 2019-02): Limit the props names to only the failing props.
    defaultValue: ({ delegate: [
      rejectedLens,
      <div {..._lensMessageInternalFailureProps}>
        <div {..._message}>
          Render Error: attributes rejected.
          {toggleableErrorDetailLens}
        </div>
        <div {..._parameter}>
          <span {..._key}>Attribute (all) names:</span>
          <span {..._value}>
            {ret.instrument(error => error.propsNames, focusDetailLens)}
          </span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _defineName("pendingFocusLens", () => ({
    tags: ["Attribute", "Context", "Lens", "Loading"],
    type: "Lens",
    description: [
`Slot for displaying a description of the focused resource that is pending
activation.`,
null,
`    @focus {Object[]} focus  the component focus that is being activated.`,
    ],
    isEnabled: true,
    defaultValue: ({ delegate: [
      pendingLens,
      <div {..._lensMessageLoadingProps}>
        <div {..._message}>Activating resource.</div>
        <div {..._parameter}>
          <span {..._key}>Focus:</span>
          <span {..._value}>{focusDescriptionLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _defineName("rejectedFocusLens", () => ({
    tags: ["Attribute", "Context", "Lens", "Loading", "Failure", "Error"],
    type: "Lens",
    description: [
`Slot for displaying an the rejection of a focus activation.`,
null,
`    @focus {Error} reason  the focus activation error.`,
    ],
    isEnabled: true,
    defaultValue: ({ delegate: [
      rejectedLens,
      <div {..._lensMessageInternalFailureProps}>
        <div {..._message}>
          Render Error: Resource activation failed.
          {toggleableErrorDetailLens}
        </div>
        <div {..._parameter}>
          <span {..._key}>Focus:</span>
          <span {..._value}>
            {ret.instrument(error => error.resource, focusDescriptionLens)}
          </span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));


  _defineName("pendingFrameLens", () => ({
    tags: ["Attribute", "Context", "Lens", "Loading"],
    type: "Lens",
    description: [
`Slot for displaying a description of the frame resource that is being created.`,
null,
`    @focus {Object[]} frame  the valoscope frame that is being created.`,
    ],
    isEnabled: true,
    defaultValue: ({ delegate: [
      pendingLens,
      <div {..._lensMessageLoadingProps}>
        <div {..._message}>Activating frame.</div>
        <div {..._parameter}>
          <span {..._key}>Frame:</span>
          <span {..._value}>{focusDescriptionLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _defineName("rejectedFrameLens", () => ({
    tags: ["Attribute", "Context", "Lens", "Loading", "Failure", "Error"],
    type: "Lens",
    description: [
`Slot for displaying the rejection of a frame creation.`,
null,
`    @focus {Error} reason  the frame creation error.`,
    ],
    isEnabled: true,
    defaultValue: ({ delegate: [
      rejectedLens,
      <div {..._lensMessageInternalFailureProps}>
        <div {..._message}>
          Render Error: Frame activation failed.
          {toggleableErrorDetailLens}
        </div>
        <div {..._parameter}>
          <span {..._key}>Frame:</span>
          <span {..._value}>
            {ret.instrument(error => error.resource, focusDescriptionLens)}
          </span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _defineName("inactiveLens", () => ({
    tags: ["Attribute", "Context", "Lens", "Loading", "Failure"],
    type: "Lens",
    description: [
`Slot for displaying a focused inactive Resource.`,
null,
`    @focus {Object} focus  the inactive Resource focus.`,
    ],
    isEnabled: (focus?: Vrapper) => focus && focus.isInactive(),
    defaultValue: ({ delegate: [
      loadingFailedLens,
      <div {..._lensMessageLoadingFailedProps}>
        <div {..._message}>Focus {focusDescriptionLens} is inactive.</div>
        <div {..._parameter}>
          <span {..._key}>Focus resource info:</span>
          <span {..._value}>{focusDetailLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _defineName("pendingMediaLens", () => ({
    tags: ["Attribute", "Context", "Lens", "Loading"],
    type: "Lens",
    description: [
`Slot for displaying a description of a Media that is about to be used as
the lens to view the current focus but which is still being interpreted
(ie. downloaded, decoded and integrated).`,
null,
`    @focus {Media} media  the Media being interpreted.`,
    ],
    isEnabled: true,
    defaultValue: ({ delegate: [
      pendingLens,
      <div {..._lensMessageLoadingProps}>
        <div {..._message}>Downloading dependency {focusDetailLens}.</div>
        <div {..._parameter}>
          <span {..._key}>Of Media:</span>
          <span {..._value}>{focusDetailLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _defineName("rejectedMediaLens", () => ({
    tags: ["Attribute", "Context", "Lens", "Loading", "Failure", "Error"],
    type: "Lens",
    description: [
`Slot for displaying an error encountered during an attempt to use a Media
as a lens to view the current focus.`,
null,
`    @focus {Error} reason  interpretation or displaying error.`,
    ],
    isEnabled: true,
    defaultValue: ({ delegate: [
      rejectedLens,
      <div {..._lensMessageLoadingFailedProps}>
        <div {..._message}>
          Render Error: Failed to render Media interpretation.
          {toggleableErrorDetailLens}
        </div>
        <div {..._parameter}>
          <span {..._key}>Of Media:</span>
          <span {..._value}>
            {ret.instrument(error => error.media, focusDescriptionLens)}
          </span>
        </div>
        <div key="p1" {..._parameter}>
          <span {..._key}>Interpretation info:</span>
          <span {..._value}>
            {ret.instrument(error => error.mediaInfo, ret.focusDetail)}
          </span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _defineName("uninterpretableMediaLens", () => ({
    tags: ["Attribute", "Context", "Lens", "Loading", "Failure", "Error"],
    type: "Lens",
    description: [
`Slot for displaying an error that was encountered during media
interpretation.`,
null,
`    @focus {Error} reason  interpretation error.`,
    ],
    isEnabled: true,
    defaultValue: ret.rejectedMediaLens,
  }));

  _defineName("unrenderableInterpretationLens", () => ({
    tags: ["Attribute", "Context", "Lens", "Loading", "Failure", "Error"],
    type: "Lens",
    description: [
`Slot for displaying an error raised by an unrenderable media
interpretation.`,
null,
`Unrenderable interpretations are values such as octet stream, complex
native objects or the undefined value.`,
null,
`    @focus {Error} reason  interpretation displaying error.`,
    ],
    isEnabled: true,
    defaultValue: ret.rejectedMediaLens,
  }));

  _defineName("pendingElementsLens", () => ({
    tags: ["Attribute", "Context", "Lens", "Loading"],
    type: "Lens",
    description: [
`Slot for displaying a description of pending elements Promise.`,
null,
`    @focus {Object} elements  the pending elements Promise.`,
    ],
    isEnabled: true,
    defaultValue: ({ delegate: [
      loadingLens,
      <div {..._lensMessageLoadingProps}>
        <div {..._message}>  Waiting for pending elements to resolve.</div>
        <div {..._parameter}>
          <span {..._key}>Elements:</span>
          <span {..._value}>{focusDetailLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _defineName("rejectedElementsLens", () => ({
    tags: ["Attribute", "Context", "Lens", "Loading", "Failure"],
    type: "Lens",
    description: [
`Slot for displaying an element rendering rejection error.`,
null,
`    @focus {string|Error|Object} reason  element rejection error.`,
    ],
    isEnabled: true,
    // TODO(iridian, 2019-02): Add a grand-child path description to the errors.
    defaultValue: ({ delegate: [
      loadingFailedLens,
      <div {..._lensMessageInternalFailureProps}>
        <div {..._message}>
          Render Error: Elements Promise failure.
          {toggleableErrorDetailLens}
        </div>
        <div {..._parameter}>
          <span {..._key}>Elements:</span>
          <span {..._value}>
            {ret.instrument(error => error.children, focusDetailLens)}
          </span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _defineName("activatingLens", () => ({
    tags: ["Attribute", "Context", "Lens", "Loading"],
    type: "Lens",
    description: [
`Slot for displaying an activating Resource.`,
null,
`    @focus {Object} focus  the activating Resource focus.`,
    ],
    isEnabled: (focus?: Vrapper) => focus && focus.isActivating(),
    defaultValue: ({ delegate: [
      (focus, component) => {
        const activation = focus.activate();
        if (activation !== focus) activation.then(() => component.flushAndRerender("activated"));
        return undefined;
      },
      loadingLens,
      <div {..._lensMessageLoadingProps}>
        <div {..._message}>Activating focus {focusDescriptionLens}.</div>
        <div {..._parameter}>
          <span {..._key}>Focus resource info:</span>
          <span {..._value}>{focusDetailLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _defineName("inactiveLens", () => ({
    tags: ["Attribute", "Context", "Lens", "Loading", "Failure"],
    type: "Lens",
    description: [
`Slot for displaying an inactive Resource.`,
null,
`    @focus {Object} focus  the inactive Resource focus.`,
    ],
    isEnabled: (focus?: Vrapper) => focus && focus.isInactive(),
    defaultValue: ({ delegate: [
      loadingFailedLens,
      <div {..._lensMessageLoadingFailedProps}>
        <div {..._message}>Focus {focusDescriptionLens} is inactive.</div>
        <div {..._parameter}>
          <span {..._key}>Focus resource info:</span>
          <span {..._value}>{focusDetailLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _defineName("unavailableLens", () => ({
    tags: ["Attribute", "Context", "Lens", "Loading", "Failure"],
    type: "Lens",
    description: [
`Slot for displaying an unavailable Resource.`,
null,
`    @focus {Object} focus  the unavailable Resource focus.`,
    ],
    isEnabled: (focus?: Vrapper) => focus && focus.isUnavailable(),
    defaultValue: ({ delegate: [
      loadingFailedLens,
      <div {..._lensMessageLoadingFailedProps}>
        <div {..._message}>Focus {focusDescriptionLens} is unavailable.</div>
        <div {..._parameter}>
          <span {..._key}>Focus resource info:</span>
          <span {..._value}>{focusDetailLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _defineName("destroyedLens", () => ({
    tags: ["Attribute", "Context", "Lens", "Loading", "Failure"],
    type: "Lens",
    description: [
`Slot for displaying a destroyed Resource.`,
null,
`    @focus {Object} focus  the destroyed Resource focus.`,
    ],
    isEnabled: (focus?: Vrapper) => focus && (focus.isImmaterial() && !focus.isGhost()),
    defaultValue: ({ delegate: [
      loadingFailedLens,
      <div {..._lensMessageLoadingFailedProps}>
        <div {..._message}>Focus {focusDescriptionLens} has been destroyed.</div>
        <div {..._parameter}>
          <span {..._key}>Focus resource info:</span>
          <span {..._value}>{focusDetailLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _defineName("lensPropertyNotFoundLens", () => ({
    tags: ["Attribute", "Context", "Lens", "Loading", "Failure"],
    type: "Lens",
    description: [
`Slot for displaying a description of an active Resource focus which does
not have a requested lens property.`,
null,
`    @focus {Object} focus  the active Resource focus.`,
    ],
    isEnabled: true,
    defaultValue: ({ delegate: [
      loadingFailedLens,
      <div {..._lensMessageLoadingFailedProps}>
        <div {..._message}>
          Cannot find a lens property from the active focus {focusDescriptionLens}.
        </div>
        <div>
          <span {..._message}>Slots which add lens property names to be searched:</span>
          <div {..._parameter}>
            <span {..._key}>focusLensProperty:</span>
            <span {..._value}>
              {ret.instrument(ret.focusLensProperty, p => JSON.stringify(p))}
            </span>
          </div>
          <div key="p1" {..._parameter}>
            <span {..._key}>lensProperty:</span>
            <span {..._value}>
              {ret.instrument(ret.lensProperty, p => JSON.stringify(p))}
            </span>
          </div>
        </div>
        <div>
          <span {..._message}>Focus that was searched for the lens property:</span>
          <div {..._parameter}>
            <span {..._key}>detail:</span>
            <span {..._value}>{focusDetailLens}</span>
          </div>
          <div key="p1" {..._parameter}>
            <span {..._key}>has properties:</span>
            <span {..._value}>
              {ret.instrument(ret.focusPropertyKeysLens, p => JSON.stringify(p))}
            </span>
          </div>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _defineName("notLensResourceLens", () => ({
    tags: ["Context", "Lens", "Loading", "Failure"],
    type: "Lens",
    description: [
`Slot for displaying a Resource which cannot be used as a lens.`,
null,
`    @focus {Object} nonLensResource  the non-lens-able Resource.`,
    ],
    isEnabled: true,
    defaultValue: ({ delegate: [
      loadingFailedLens,
      <div {..._lensMessageLoadingFailedProps}>
        <div {..._message}>
          Resource {focusDescriptionLens} cannot be used as a lens.
          This is because it is not a valid lens Media file nor does it
          have a lens property that is listed in either
          %27delegateLensProperty%27 or %27lensProperty%27 slots.
        </div>
        <div>
          <span {..._message}>Slots which add lens property names to be searched:</span>
          <div {..._parameter}>
            <span {..._key}>delegateLensProperty:</span>
            <span {..._value}>
              {ret.instrument(ret.delegateLensProperty, p => JSON.stringify(p))}
            </span>
          </div>
          <div key="p1" {..._parameter}>
            <span {..._key}>lensProperty:</span>
            <span {..._value}>
              {ret.instrument(ret.lensProperty, p => JSON.stringify(p))}
            </span>
          </div>
        </div>
        <div>
          <span {..._message}>Resource that was searched for the lens property:</span>
          <div {..._parameter}>
            <span {..._key}>Lens candidate detail:</span>
            <span {..._value}>{focusDetailLens}</span>
          </div>
          <div key="p1" {..._parameter}>
            <span {..._key}>Lens candidate has properties:</span>
            <span {..._value}>
              {ret.instrument(ret.focusPropertyKeysLens, p => JSON.stringify(p))}
            </span>
          </div>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _defineName("arrayNotIterableLens", () => ({
    tags: ["Context", "Lens", "Loading", "Failure"],
    type: "Lens",
    description: [
`Slot for displaying a valoscope $Lens.array which is not an iterable.`,
null,
`    @focus {Object} nonArray  the non-iterable value.`,
    ],
    isEnabled: true,
    defaultValue: ({ delegate: [
      loadingFailedLens,
      <div {..._lensMessageLoadingFailedProps}>
        <div {..._message}>props.array {focusDescriptionLens} is not an iterable.</div>
        <div {..._parameter}>
          <span {..._key}>props.array:</span>
          <span {..._value}>{focusDetailLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));

  _defineName("invalidElementLens", () => ({
    tags: ["Context", "Lens", "Loading", "Failure"],
    type: "Lens",
    description: [
`Slot for displaying an a description of an invalid UI element.`,
null,
`    @focus {Object} description  string or object description.`,
    ],
    isEnabled: true,
    defaultValue: ({ delegate: [
      loadingFailedLens,
      <div {..._lensMessageLoadingFailedProps}>
        <div {..._message}>
            {ret.instrument(parentComponentLens, focusDetailLens)}
            returned an invalid element.
        </div>
        <div {..._parameter}>
          <span {..._key}>Faults:</span>
          <span {..._value}>{focusDumpLens}</span>
        </div>
        {commonMessageRows}
      </div>
    ] }),
  }));
  return ret;
}
