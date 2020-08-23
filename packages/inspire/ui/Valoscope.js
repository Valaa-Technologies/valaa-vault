// @flow

import PropTypes from "prop-types";

import { naiveURI } from "~/raem/ValaaURI";
import { conjoinVPathSection, disjoinVPathOutline } from "~/raem/VPath";
import { vRef } from "~/raem/VRL";

// import type { Connection } from "~/sourcerer";

import Vrapper from "~/engine/Vrapper";

import UIComponent from "~/inspire/ui/UIComponent";
import Lens from "~/inspire/valosheath/valos/Lens";

import { thisChainEagerly, thisChainRedirect } from "~/tools";

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
  static isValoscope = true;
  static mainLensSlotName = "valoscopeLens";

  static propTypes = {
    ...UIComponent.propTypes,

    frameOwner: PropTypes.object,
    frameAuthority: PropTypes.string,
    frameKey: PropTypes.string,
    staticFrameKey: PropTypes.string,
    implicitFrameKey: PropTypes.string,
    frameOverrides: PropTypes.object,
    instanceLensPrototype: PropTypes.any,
  };

  shouldComponentUpdate (nextProps: Object, nextState: Object) {
    let ret;
    if (nextProps.children !== this.props.children) {
      // FIXME(iridian, 2020-07): Ugly hack: duplicate code with code
      // below. children handling should probably be moved to
      // Valens. Like all of Valoscope handling tbf.
      this.setUIContextValue(Lens.children, nextProps.children);
      ret = "props.children";
    }
    if (nextProps.frameOverrides && (nextState.scopeFrame !== undefined)) {
      const frameSelf = { component: this, frameOverrides: nextProps.frameOverrides };
      let releaseOpts;
      try {
        if (_integrateFramePropertyDiffs(frameSelf, nextState.scopeFrame)) {
          ret = "props.frameOverrides";
        }
      } catch (error) {
        releaseOpts = { rollback: error };
        this.enableError(error);
        ret = "props.frameOverrides.error";
      } finally {
        if (frameSelf.discourse) frameSelf.discourse.releaseFabricator(releaseOpts);
      }
    }
    if (ret) this._cachedRendering = undefined;
    else ret = super.shouldComponentUpdate(nextProps, nextState);
    return ret;
  }

  bindFocusSubscriptions (focus: any, props: Object) {
    super.bindFocusSubscriptions(focus, props);
    this.setUIContextValue(Lens.children, props.children);
    let vPrototype;
    if (props.hasOwnProperty("instanceLensPrototype")) {
      vPrototype = props.instanceLensPrototype;
      if (!(vPrototype instanceof Vrapper)) {
        throw new Error(
            `Invalid instanceLensPrototype: must be a valid resource, got '${typeof vPrototype}'`);
      }
    }
    const vLens = (props.lens instanceof Vrapper) && props.lens;
    const frameSelf = {
      component: this, focus, props, engine: this.context.engine,
      vOwner: (props.frameOwner !== undefined)
          ? props.frameOwner
          : this.getParentUIContextValue(Lens.scopeFrameResource),
      vPrototype, vLens,
      frameOverrides: props.frameOverrides,
    };
    return thisChainEagerly(frameSelf,
        [
          vPrototype && vPrototype.activate(),
          vLens && vLens.activate(),
          this.maybeDelayed(Lens.pendingFrameLens, props.frameKey),
        ],
        _scopeFrameChain,
        (error) => {
          if (frameSelf.discourse) {
            frameSelf.discourse.releaseFabricator({ rollback: error });
            frameSelf.discourse = null;
          }
          throw this.enableError(error);
        },
    );
  }

  renderLoaded (focus: any) {
    return Array.isArray(focus)
        ? this.renderFocusAsSequence(focus, Valoscope, this.props.forEach, this.props.children)
        // Render using current focus as the lens with null as the focus.
        : this.renderLens(focus, null, "focus");
  }
}

const _scopeFrameChain = [
  function _processFramePrototypeAndFocus () {
    let frameAuthorityProperty;

    const propsFrameAuthority = this.component.props.frameAuthority;
    if (propsFrameAuthority !== undefined) return propsFrameAuthority;

    if ((this.vPrototype != null) && this.vPrototype.hasInterface("Scope")) {
      const prototypeFrameAuthorityURI = this.vPrototype.propertyValue(
          (frameAuthorityProperty = this.component.getUIContextValue(Lens.frameAuthorityProperty)));
      if (prototypeFrameAuthorityURI !== undefined) {
        return prototypeFrameAuthorityURI;
      }
    }
    if (!(this.focus instanceof Vrapper)) return undefined;
    this.vFocus = this.focus;
    this.vFocus.requireActive(); // focus should always be activated by Valoscope itself

    const currentShadowedFocus = this.component.getParentUIContextValue(Lens.frameRootFocus);
    if (this.vFocus === currentShadowedFocus) return undefined;

    if (this.vFocus.hasInterface("Scope")) {
      const focusFrameAuthorityURI = this.vFocus.propertyValue(frameAuthorityProperty
          || this.component.getUIContextValue(Lens.frameAuthorityProperty));
      if (focusFrameAuthorityURI !== undefined) {
        return focusFrameAuthorityURI;
      }
    }

    if (this.vFocus.isChronicleRoot()) {
      const contextFrameAuthorityURI =
          this.component.getUIContextValue(Lens.frameAuthority);
      if (contextFrameAuthorityURI !== undefined) {
        return contextFrameAuthorityURI;
      }
    }
    return undefined;
  },

  function _constructIdAndCheckForExistingFrame (rootFrameAuthorityURI) {
    const isTransitory = this.isTransitory = (rootFrameAuthorityURI
            || (this.vOwner ? this.vOwner.getConnection().getAuthorityURI() : "valaa-memory:"))
        === "valaa-memory:";
    function _getSubscriptId (vResource) {
      return isTransitory
          ? `${vResource.getBriefUnstableId()}@@`
          : vResource.getRawId();
    }
    const props = this.component.props;
    const frameKey = props.frameKey || props.staticFrameKey;
    const frameOutline = [];
    if (frameKey) {
      frameOutline.push(`@-:FR:${frameKey}`);
      this.component.setUIContextValue(Lens.frameStepPrefix,
          !props.staticFrameKey || (props.arrayIndex == null) ? "" : String(props.arrayIndex));
    } else {
      const stepPrefix = this.component.getParentUIContextValue(Lens.frameStepPrefix);
      frameOutline.push(`@-:FR${stepPrefix ? `:${stepPrefix}}` : ""}`);
      if (this.vFocus) frameOutline.push(["@$focus", [_getSubscriptId(this.vFocus)]]);
      if (props.arrayIndex) frameOutline.push(props.arrayIndex);
      if (this.vLens) frameOutline.push(["@$lens", [_getSubscriptId(this.vLens)]]);
      this.component.setUIContextValue(Lens.frameStepPrefix, "");
    }
    // const prototypePart = this.vPrototype ? `@_$V.proto${_getSubscriptId(this.vPrototype)}` : "";
    const frameSection = disjoinVPathOutline(frameOutline, "@@");
    const frameStep = conjoinVPathSection(frameSection);
    if (rootFrameAuthorityURI && (isTransitory || !this.vOwner)) {
      this.frameId = `@$~V.frames${
          this.vOwner ? this.vOwner.getBriefUnstableId() : ""}${frameStep}@@`;
    } else if (rootFrameAuthorityURI || this.vOwner) {
      this.frameRef = this.vOwner.getVRef().getSubRef(frameStep);
      // console.log("frameRef:", this.frameRef.rawId());
      this.frameId = this.frameRef.vrid();
    } else {
      throw new Error("Frame is missing both owner and authorityURI");
    }
    const vFrame = this.engine.tryVrapper(this.frameRef || this.frameId, { optional: true });
    if (vFrame !== undefined) {
      this.frameRef = vFrame.getVRef();
      return thisChainRedirect("_finalizeScopeFrame", vFrame);
    }
    if (!rootFrameAuthorityURI || (this.vPrototype && !this.vPrototype.hasInterface("Chronicle"))) {
      return thisChainRedirect("_createFrame");
    }
    this.rootFrameAuthorityURI = rootFrameAuthorityURI;
    const chronicleURI = naiveURI.createChronicleURI(rootFrameAuthorityURI, this.frameId);
    if (this.frameRef) {
      this.frameRef = this.frameRef.immutateWithChronicleURI(chronicleURI);
    } else {
      this.frameRef = vRef(this.frameId, undefined, undefined, chronicleURI);
    }
    return this.engine.discourse.acquireConnection(chronicleURI).asActiveConnection();
  },

  function _obtainRootFrame (/* rootFrameConnection: Connection */) {
    const vRootFrame = this.engine.tryVrapper(this.frameId, { optional: true });
    if (vRootFrame) {
      return thisChainRedirect("_finalizeScopeFrame", vRootFrame);
    }
    return undefined;
  },

  function _createFrame () {
    if (!this.rootFrameAuthorityURI && !this.vOwner) {
      throw new Error(`Cannot obtain scope frame: neither root frame authorityURI ${
          ""}nor non-root frame owner could be determined`);
    }
    const initialState = { id: this.frameRef, name: this.frameId };
    if (this.rootFrameAuthorityURI) {
      initialState.authorityURI = this.rootFrameAuthorityURI;
      initialState.owner = null;
    } else {
      initialState.owner = this.vOwner;
    }
    if (this.frameOverrides) {
      initialState.properties = { ...this.frameOverrides };
      this.component._currentOverrides = this.frameOverrides;
      this.frameOverrides = null;
    }
    const options = {
      discourse: this.discourse = this.engine
          .obtainGroupTransaction("frame").acquireFabricator("createFrame"),
    };
    const vScopeFrame = (this.vPrototype != null)
        ? this.vPrototype.instantiate(initialState, options)
        : this.engine.create("Entity", initialState, options);
    this.chronicling = options.chronicling;
    if (this.rootFrameAuthorityURI && this.vFocus) {
      this.component.setUIContextValue(Lens.frameRootFocus, this.vFocus);
      this.component.setUIContextValue(Lens.frameRoot, vScopeFrame);
    }
    return vScopeFrame;
  },
  function _finalizeScopeFrame (vScopeFrame) {
    this.component.setUIContextValue("frame", vScopeFrame);
    this.component.setUIContextValue(Lens.scopeFrameResource, vScopeFrame);
    const engine = this.component.context.engine;
    const staticFrameKey = this.component.props.staticFrameKey;
    const vParent = this.vOwner || this.component.getParentUIContextValue(Lens.scopeFrameResource);
    if (staticFrameKey && vParent && (vParent.propertyValue(staticFrameKey) !== vScopeFrame)) {
      // TODO(iridian): This is initial, non-rigorous prototype functionality:
      // The owner[key] value remains set even after the components get detached.
      vParent.assignProperty(staticFrameKey, vScopeFrame, {
        discourse: this.discourse || (this.discourse =
            engine.obtainGroupTransaction("frame").acquireFabricator("setOwnerFrameKey")),
      });
    }
    if (this.frameOverrides) _integrateFramePropertyDiffs(this, vScopeFrame);
    const discourse = this.discourse;
    if (discourse) {
      this.discourse = null;
      const result = discourse.releaseFabricator();
      if (!this.isTransitory && (result || this.chronicling)) {
        return [vScopeFrame, (result || this.chronicling).getPersistedEvent()];
      }
    }
    return vScopeFrame;
  },
  function _setScopeFrameState (scopeFrame) {
    this.component.rerender("frame", { scopeFrame });
    return false;
  },
];

function _integrateFramePropertyDiffs (frameSelf, scopeFrame) {
  const currentOverrides = frameSelf.component._currentOverrides || {};
  if (currentOverrides === frameSelf.frameOverrides) return false;
  const updateTarget = (scopeFrame instanceof Vrapper) ? {} : scopeFrame;
  for (const [key, value] of Object.entries(frameSelf.frameOverrides)) {
    if (currentOverrides[key] === frameSelf.frameOverrides[key]) continue;
    updateTarget[key] = value;
  }
  if (updateTarget === scopeFrame) return true; // frame is an object, refresh immediately
  scopeFrame.assignProperties(updateTarget, {
    discourse: frameSelf.discourse || (frameSelf.discourse =
          scopeFrame.getEngine().obtainGroupTransaction("frame").acquireFabricator("frameDiffs")),
  });
  frameSelf.component._currentOverrides = frameSelf.frameOverrides;
  return false; // let live kuery system handle updates
}
