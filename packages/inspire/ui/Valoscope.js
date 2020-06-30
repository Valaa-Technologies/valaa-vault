// @flow
import PropTypes from "prop-types";

import { naiveURI } from "~/raem/ValaaURI";
import { tryUnpackedHostValue } from "~/raem/VALK/hostReference";

// import type { Connection } from "~/sourcerer";

import VALEK from "~/engine/VALEK";
import Vrapper from "~/engine/Vrapper";

import UIComponent from "~/inspire/ui/UIComponent";
import Lens from "~/inspire/ui/Lens";

import { thisChainEagerly } from "~/tools";

/**
 * Valoscope performs a semantically rich, context-aware render of its local UI focus according to
 * following rules:
 *
 * 1. If component is disabled (ie. its local UI context is undefined):
 *    value-renders (value-rendering defined in section 9.) props/context "disabledLens".
 *    disabledLens must not make any UI context nor UI focus references.
 *
 * 2. If main UI focus kuery is still pending (ie. UI focus is undefined):
 *    value-renders props/context "pendingLens", "loadingLens" or "disabledLens".
 *    A pending kuery is an asynchronous operation which hasn't returned the initial set of values.
 *    pendingLens can refer to UI context normally, but cannot refer to (still-undefined) UI focus.
 *
 * 3. If props.lens or context.lens is defined:
 *    value-renders props/context "lens".
 *    This allows overriding any further render semantics with a specific, hard-coded UI element
 *    which still knows that the main UI focus kuery has been completed.
 *    lens can refer to UI context and UI focus normally.
 *
 * 4. If UI focus is null:
 *    value-renders props/context "nullLens" or "disabledLens".
 *
 * 5. If UI focus is a string, a number, a React element, a function or a boolean:
 *    value-renders focus.
 *    This is the basic literal value rendering rule.
 *    Any React element or function content can refer to UI context and UI focus normally.
 *
 * 6. If UI focus is a valos resource, an appropriate valos Lens for it is located and rendered
 *    (with the resource set as its focus) as per rules below.
 *    valos Lens is a UI component which always has valos Resource as its focus.
 * 6.1. If UI focus is not an Active valos resource, ie. if any of its chronicless does not have a
 *    fully formed active connection, then:
 * 6.1.1. If UI focus is an Inactive valos resource, ie. if some of its chronicles are not connected
 *    and no connection attempt is being made:
 *    value-renders props/context "inactiveLens" or "disabledLens".
 * 6.1.2. If UI focus is an Activating valos resource, ie. if all of its chronicles are either
 *    connected or a connection attempt is being made:
 *    value-renders props/context "activatingLens", "loadingLens" or "disabledLens".
 * 6.1.3. If UI focus is an Unavailable valos resource, ie. if some of its chronicles connections
 *    have failed (due to networks issues, permission issues etc.):
 *    value-renders props/context "unavailableLens" or "disabledLens".
 * 6.1.4. If UI focus is an Immaterial non-ghost valos resource:
 *    value-renders props/context "destroyedLens" or "disabledLens".
 * 6.2. If props.activeLens or context.activeLens is defined:
 *    value-renders props/context "activeLens".
 *    Like lens this overrides all further render semantics, but unlike lens
 *    the activeLens content can assume that UI focus is always a valid valos Resource.
 * 6.3. if either props.lensProperty or context.lensProperty is defined (lensProperty from hereon)
 *    and getFocus().propertyValue(lensProperty) is defined:
 *    value-renders getFocus().propertyValue(lensProperty).
 * 6.4. otherwise:
 *    value-renders props/context "lensPropertyNotFoundLens" or "disabledLens".
 *
 * 7. If UI focus is an array or a plain object, Valoscope behaves as if it was a ForEach component
 *    and renders the focus as a sequence, with following rules:
 * 7.1. all Valoscope props which ForEach uses are forwarded to ForEach as-is,
 * 7.2. props.EntryUIComponent default value is Valoscope instead of UIComponent,
 * 7.3. if UI focus is a plain object it is converted into an array using following rules:
 * 7.3.1. array entries are the UI focus object values, ordered lexicographically by their keys,
 * 7.3.2. the ForEach entry props (and thus the React key) for each entry element is created using
 *    childProps(key, { ... }) instead of uiComponentProps({ ... }).
 *
 * 8. Otherwise:
 *    throws a failure for unrecognized UI focus (ie. a complex non-recognized object)
 *
 * 9. value-render process renders a given value(s) directly ie.
 *    without further valos or react operations), as follows:
 * 9.1. if value-render is given multiple values, the first one which is defined is used as value,
 * 9.2. if value === false, if value === null or if it is not defined:
 *    renders null.
 * 9.3. if value is a function:
 *    value-renders value(getUIContext()).
 *    The current UI focus can be found in getUIContext().focus.
 * 9.4. if value === true:
 *    renders props.children.
 * 9.5. if value is a string, number, or a React element:
 *    renders value.
 * 9.6. if value is a valos Resource:
 *    renders <Valoscope focus={value} />.
 * 9.7. otherwise:
 *    throws an exception for unrecognized value
 *
 * @export
 * @class Valoscope
 * @extends {UIComponent}
 */
export default class Valoscope extends UIComponent {
  static mainLensSlotName = "valoscopeLens";

  static propTypes = {
    ...UIComponent.propTypes,
    lensName: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]),
  };

  static contextTypes = {
    ...UIComponent.contextTypes,
    engine: PropTypes.object,
  };

  bindFocusSubscriptions (focus: any, props: Object) {
    super.bindFocusSubscriptions(focus, props);
    this.setUIContextValue(Lens.scopeChildren, props.children);
    const vPrototype = props.instanceLensPrototype;
    return thisChainEagerly({
          component: this,
          engine: this.context.engine,
          Lens,
          vOwner: this.getParentUIContextValue(Lens.scopeFrameResource),
          key: this.getKey(),
          vPrototype,
          focus,
          vLens: (props.lens instanceof Vrapper) && props.lens,
          lensAuthorityProperty: this.getUIContextValue(Lens.lensAuthorityProperty),
        },
        [vPrototype && vPrototype.activate()],
        _scopeFrameChain,
        (error) => { throw this.enableError(error); }
    );
  }

  renderLoaded (focus: any) {
    if (Array.isArray(focus)) {
      return this.renderFocusAsSequence(focus, this.props.forEach, Valoscope);
    }
    // Render using current focus as the lens and null as the focus.
    return this.renderLens(focus, null, "focus");
  }
}

const _scopeFrameChain = [
  function _processFramePrototypeAndFocus () {
    if ((this.vPrototype != null) && this.vPrototype.hasInterface("Scope")) {
      const prototypeLensAuthorityURI = this.vPrototype.propertyValue(this.lensAuthorityProperty);
      if (prototypeLensAuthorityURI !== undefined) {
        this.rootFrameAuthorityURI = prototypeLensAuthorityURI;
      }
    }
    if (!(this.focus instanceof Vrapper)) return undefined;
    this.vFocus = this.focus;
    this.vFocus.requireActive(); // focus should always be activated by Valoscope itself

    const currentShadowedFocus = this.component.getParentUIContextValue(Lens.shadowedFocus);
    if (this.vFocus === currentShadowedFocus) return undefined;

    if (this.vFocus.hasInterface("Scope")) {
      const focusLensAuthorityURI = this.vFocus.propertyValue(this.lensAuthorityProperty);
      if (focusLensAuthorityURI !== undefined) {
        return focusLensAuthorityURI;
      }
    }

    if (this.vFocus.isChronicleRoot()) {
      const contextShadowLensAuthorityURI =
          this.component.getUIContextValue(Lens.shadowLensAuthority);
      if (contextShadowLensAuthorityURI !== undefined) {
        return contextShadowLensAuthorityURI;
      }
    }
    return undefined;
  },

  function _constructIdAndCheckForExistingFrame (rootFrameAuthorityURI) {
    const isTransitory = (rootFrameAuthorityURI || this.vOwner.getConnection().getAuthorityURI())
        === "valaa-memory:";
    function _getSubscriptId (vResource) {
      if (!isTransitory) return vResource.getRawId().slice(0, -2);
      const brief = vResource.getBriefUnstableId();
      return `@${brief[1]}$.${brief.slice(3, brief.indexOf("@", 4))}`;
    }
    const structuralPart = this.frameKey
        ? `@_$.${encodeURIComponent(this.frameKey)}`
        : `@_$V.owner${_getSubscriptId(this.vOwner)}@_$.${encodeURIComponent(this.key)}`;
    const prototypePart = this.vPrototype ? `@_$V.proto${_getSubscriptId(this.vPrototype)}` : "";
    const focusPart = this.vFocus ? `@_$V.focus${_getSubscriptId(this.vFocus)}` : "";
    const lensPart = this.vLens ? `@_$V.lens${_getSubscriptId(this.vLens)}` : "";
    this.frameId = `@$~V.frames${structuralPart}${prototypePart}${focusPart}${lensPart}@@`;

    const vFrame = this.engine.tryVrapper(this.frameId, { optional: true });
    if (vFrame !== undefined) {
      return { _assignScopeFrameExternals: [vFrame] };
    }
    if (!rootFrameAuthorityURI
        || (prototypePart && !this.vPrototype.hasInterface("Chronicle"))) {
      return { _createFrame: [] };
    }
    return [rootFrameAuthorityURI];
  },

  function _sourcifyRootFrameChronicle (rootFrameAuthorityURI) {
    this.rootFrameAuthorityURI = rootFrameAuthorityURI;
    const chronicleURI = naiveURI.createChronicleURI(rootFrameAuthorityURI, this.frameId);
    const discourse = this.discourse
        || (this.discourse = this.engine.getActiveGlobalOrNewLocalEventGroupTransaction());
    return [discourse.acquireConnection(chronicleURI).asActiveConnection()];
  },

  function _obtainRootFrame (/* rootFrameConnection: Connection */) {
    const vRootFrame = this.engine.tryVrapper(this.frameId, { optional: true });
    if (vRootFrame) return { _assignScopeFrameExternals: [vRootFrame] };
    return [];
  },

  function _createFrame () {
    if (!this.rootFrameAuthorityURI && !this.vOwner) {
      throw new Error(`Cannot obtain scope frame: neither root frame authorityURI ${
          ""}nor non-root frame owner could be determined`);
    }
    const initialState = { id: this.frameId, name: this.frameId };
    if (this.rootFrameAuthorityURI) {
      initialState.authorityURI = this.rootFrameAuthorityURI;
      initialState.owner = null;
    } else {
      initialState.owner = this.vOwner;
    }
    const discourse = this.discourse
        || (this.discourse = this.engine.getActiveGlobalOrNewLocalEventGroupTransaction());
    /*
    discourse = engine.obtainGroupTransaction("receive-events", {
      finalizer: Promise.resolve(),
    });
    */
    // TODO(iridian, 2019-01): Determine whether getPremiereStory
    // is the desired semantics here. It waits until the
    // resource creation narration has completed (ie. engine
    // has received and resolved the recital): this might be
    // unnecessarily long.
    // OTOH: TransactionState.chronicleEvents.results only
    // support getPremiereStory so whatever semantics is
    // desired it needs to be implemented.
    // const options = { discourse, awaitResult: result => result.getPremiereStory() };
    const options = { discourse, awaitResult: result => result.getComposedStory() };
    const vScopeFrame = (this.vPrototype != null)
        ? this.vPrototype.instantiate(initialState, options)
        : this.engine.create("Entity", initialState, options);
    if (!this.rootFrameAuthorityURI || !this.vFocus) {
      return { _assignScopeFrameExternals: [vScopeFrame] };
    }
    return [vScopeFrame];
  },

  function _assignShadowLensContextvalues (vScopeFrame) {
    this.component.setUIContextValue(Lens.shadowedFocus, this.vFocus);
    this.component.setUIContextValue(Lens.shadowLensChronicleRoot,
        this.rootFrameAuthorityURI ? vScopeFrame : null);
    return [vScopeFrame];
  },

  function _assignScopeFrameExternals (scopeFrame) {
    this.component.setUIContextValue("frame", scopeFrame);
    if (scopeFrame === undefined) return undefined;
    if ((typeof this.key === "string") && (this.key[0] !== "-")
        && (this.vOwner != null)
        // && (this.vOwner instanceof Vrapper) && this.vOwner.hasInterface("Scope")
        && (this.vOwner.propertyValue(this.key) !== scopeFrame)) {
      // TODO(iridian): This is initial non-rigorous prototype functionality:
      // The owner[key] value remains set even after the components get detached.
      this.vOwner.alterProperty(this.key, VALEK.fromValue(scopeFrame));
    }
    const vScopeFrame = tryUnpackedHostValue(scopeFrame);
    if (vScopeFrame) this.component.setUIContextValue(Lens.scopeFrameResource, vScopeFrame);
    return [vScopeFrame || scopeFrame];
  },

  function _setScopeFrameState (scopeFrame) {
    return [this.component.setState({ scopeFrame })];
  },
];

/*
const _description =
`Returns an existing or creates a new Resource or object to be used as
the scope frame for a Valoscope component. This scope frame is then
made available as 'frame' to its child lenses via context. By default
creates a valos Resource as follows:
1. A *derived id* for the Resource will be derived using rules
  described below. If a Resource by that id exists that Resource will
  be used as-is.
  Otherwise a new Resource is created with that id.
2. If defined the *prototype* is used as part of the id derivation and
  the possible new Resource will use the prototype as its
  Resource.instancePrototype. Additionally if the prototype has a lens
  authority property its value will be defined as the *lens authority*.
  Otherwise (if prototype is undefined) a new Entity is created.
3. If defined the *owner* is used as part of the id derivation.
4. If *focus* is a singular Resource its id is used as part of the id
  derivation. Then if lens authority is not yet defined and if the
  focus has a lens authority property its value will is defined as the
  lens authority. Alternatively, if the focus is a chronicle root then
  valos.shadowLensAuthority is defined as the lens authority.
  Otherwise (focus is not a singular Resource) focus is not used in id
  derivation.
5. If the lens authority is defined and is not falsy it's used as the
  Chronicle.authorityURI of the possible new Resource.
  Otherwise if the *owner* is defined it's used as Resource.owner for
  the possible new Resource.
  Otherwise no scope frame is obtained and frame is set to null.
  Note that even if a new chronicle is created for a Resource (in which
  case it will not be given an owner) the owner id and lens name are
  used as part of the id derivation.
6. If the component has a custom key then it will be used as part of
  the id derivation. Additionally if the surrounding context defines a
  non-falsy 'frame' then the obtained scope frame that is obtained is
  also assigned to 'frame[key]'.
  Otherwise an autogenerated key which accounts for the relative
  position of the component inside its lens definition file is used as
  part of the id derivation.
7. A scope frame is *elidable* if
  1. its component has an autogenerated key,
  2. its child lenses don't refer to 'frame', and
  3. each of its immediately descendant Valoscope child
      components is either elidable itself or has
      an autogenerated key and defines lens authority.
  An implementation may skip the creation of an elidable scope frame.
  This is true even if it would have side effects that are visible
  elsewhere (ie. a scope frame creation can be elided even if it would
  be created into a remote authority).
`;
*/
