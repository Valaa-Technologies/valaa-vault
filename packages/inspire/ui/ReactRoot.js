import React from "react";
import PropTypes from "prop-types";
import preset from "jss-preset-default";
import jss, { SheetsManager } from "jss";

import { naiveURI } from "~/raem/ValaaURI";
import derivedId from "~/raem/tools/derivedId";

import Vrapper, { getImplicitMediaInterpretation } from "~/engine/Vrapper";

import { VSSStyleSheetSymbol } from "~/inspire/ui/UIComponent";
import { unthunkRepeat } from "~/inspire/ui/thunk";
import Valoscope from "~/inspire/ui/Valoscope";
import { VS } from "~/engine/VALEK";

import {
  dumpObject, invariantifyString, traverse, wrapError, outputError, valosHash, thenChainEagerly,
} from "~/tools";

const { symbols: Lens } = require("~/inspire/Lens");

jss.setup(preset());

const _sheetIds = new WeakMap();

export default class ReactRoot extends React.Component {
  static propTypes = {
    isRoot: PropTypes.bool,
    viewName: PropTypes.string,
    children: PropTypes.object,
    contextLensProperty: PropTypes.arrayOf(PropTypes.string),
    rootUIContext: PropTypes.object,
    rootProps: PropTypes.object,
  };

  static childContextTypes = {
    engine: PropTypes.object,
    parentUIContext: PropTypes.object,

    // lensProperty: PropTypes.arrayOf(PropTypes.string),
    // lensPropertyNotFoundLens: PropTypes.any,

    css: PropTypes.func,
    getVSSSheet: PropTypes.func,
    releaseVssSheets: PropTypes.func,
  };

  constructor (props, context) {
    super(props, context);
    this.cssRoot = {};
    const vRootFocus = (props.rootProps || {}).focus;
    this._rootContext = this._createRootContext(vRootFocus, props.rootUIContext);
    this._rootContext.context = this._rootContext;
    this._rootContext.reactComponent = this;
    this._rootContext[Lens.currentRenderDepth] = 0;
    this._rootContext[Lens.arrayIndex] = null;
    this._rootContext[Lens.elementIndex] = null;
    this._rootContext[Lens.lensProperty] = this.props.contextLensProperty;
    if (vRootFocus) {
      thenChainEagerly(this._obtainUIRootFrame(
          this._rootContext[Lens.frameAuthority], vRootFocus, props.viewName), [
        frame => {
          this._rootContext.frame = frame;
          this._rootContext[Lens.scopeFrameResource] = frame;
          this.forceUpdate();
        },
      ], error => {
        outputError(error, "Exception caught during ReactRoot._createRootContext");
        throw error;
      });
    }
  }

  getChildContext () {
    const focus = (this.props.rootProps || {}).focus;
    return {
      engine: focus && focus.getEngine(),
      parentUIContext: this._rootContext,
      css: (...cssClassPaths: string[]) =>
        cssClassPaths.map(cssClassPath => {
          const className = traverse(this.cssRoot, cssClassPath);
          invariantifyString(className, `css(${cssClassPath}) resolution`,
              ", when resolved against css root:", this.cssRoot);
          return className;
        })
        .join(" "),
      getVSSSheet: this.getVSSSheet,
      releaseVssSheets: this.releaseVssSheets,
    };
  }

  getKey () { return "-root"; }

  componentDidMount () { // eslint-disable-line
    this._initializeVSSSheetManager();
  }

  componentWillUnmount () {
    this._cleanupVssSheets();
  }

  _initializeVSSSheetManager () {
    this._vssSheetManager = new SheetsManager();
    this._vssSheetUsers = new WeakMap();
  }

  _cleanupVssSheets () {
    for (const sheet of this._vssSheetManager.sheets) {
      sheet.detach();
    }
  }

  /**
   * Lookup or create a jss sheet for a given context. Updates reference count of sheet via the
   * SheetsManager, making sure that each user only has 1 reference to a sheet.
   */

  getVSSSheet = (context: Object, user: Object) => {
    let sheetId = _sheetIds.get(context);
    if (!sheetId) {
      sheetId = valosHash(context);
      _sheetIds.set(context, sheetId);
    }
    let sheet = this._vssSheetManager.get(sheetId);
    if (!sheet) {
      sheet = this._createJssSheet(sheetId, context, user);
    } else {
      this._referenceJssSheet(sheetId, sheet, user);
    }
    return sheet;
  }

  _createJssSheet (sheetId: string, context: Object, initialUser: Object) {
    const sheet = jss.createStyleSheet(context);
    this._vssSheetManager.add(sheetId, sheet);
    this._vssSheetManager.manage(sheetId);
    this._vssSheetUsers.set(sheet, [initialUser]);
    return sheet;
  }

  _referenceJssSheet (sheetId: string, sheet: Object, user: Object) {
    const sheetUsers = this._vssSheetUsers.get(sheet);
    if (sheetUsers.indexOf(user) === -1) {
      this._vssSheetManager.manage(sheetId);
      this._vssSheetUsers.set(sheet, [...sheetUsers, user]);
    }
  }

  /**
   * For the given user, release all references to VSS sheets. If a sheet has 0 refs it will be
   * detached from the DOM.
   */
  releaseVssSheets = (user: Object) => {
    for (const sheetId of this._vssSheetManager.keys) {
      const sheet = this._vssSheetManager.get(sheetId);
      const users = this._vssSheetUsers.get(sheet);
      if (users.indexOf(user) > -1) {
        this._vssSheetManager.unmanage(sheetId);
        this._vssSheetUsers.set(sheet, [...users.filter(u => u !== user)]);
      }
    }
  }

  _createRootContext (vRootFocus: Vrapper, customUIScope: Object) {
    const rootContext = Object.create(customUIScope || vRootFocus.getEngine().getRootScope());
    rootContext.VSS = this._createVSS(vRootFocus && vRootFocus.getEngine());
    rootContext.VS = VS;
    return rootContext;
  }

  async _obtainUIRootFrame (authorityURI: string, vRootFocus: Vrapper, viewName: string) {
    const localInstanceVRID = derivedId(
        vRootFocus.getRawId(), "ui-roots", `@$~raw.${encodeURIComponent(viewName)}@@`);
    const chronicleURI = naiveURI.createChronicleURI(authorityURI, localInstanceVRID);
    await vRootFocus.getEngine().discourse
        .sourcifyChronicle(chronicleURI)
        .asSourceredConnection();
    let vLocalUIRoot = vRootFocus.getEngine()
        .getVrapperByRawId(localInstanceVRID, { optional: true });
    if (!vLocalUIRoot) {
      vLocalUIRoot = await vRootFocus.getEngine().create("Entity", {
        id: localInstanceVRID, owner: null,
        name: `Local UI root view '${viewName}' to '${vRootFocus.debugId()}'`,
        authorityURI,
      });
    }
    return vLocalUIRoot;
  }

  _createVSS (engine: Object) {
    const reactRoot = this;
    return function VSS (...rest: any[]) {
      try {
        const ret = { data: "" };
        const rootSheet = getImplicitMediaInterpretation(this[VSSStyleSheetSymbol],
            "VSS.rootStyleSheet", { fallbackContentType: "text/css", discourse: engine.discourse });
        const contextSheet = rootSheet
            && reactRoot.getVSSSheet(rootSheet, this.reactComponent).classes;
        reactRoot._resolveVSSOption(this, engine, ret, contextSheet, rest);
        return ret.data;
      } catch (error) {
        throw wrapError(error, `During ${this.reactComponent.debugId()}\n .VSS:`,
            "\n\targs:", ...rest,
            "\n\tprops:", this.reactComponent.props,
            "\n\tstate:", this.reactComponent.state);
      }
    };
  }

  _resolveVSSOption (localContext: Object, engine, result: Object, sheet: ?Object, option: any) {
    try {
      if (typeof option === "string") {
        option.split(" ").forEach(sheetClassKey => {
          if (!sheet) {
            result.data += sheetClassKey;
            result.data += " ";
          } else {
            const sheetClassValue = sheet[sheetClassKey];
            const className = unthunkRepeat(sheetClassValue, localContext);
            if ((typeof className === "string") && (className !== "")) {
              result.data += className;
              result.data += " ";
            } else {
              console.warn(`Invalid or missing VSS className by '${sheetClassKey}' in sheet`, sheet,
                  "\n\texpected non-empty string, got:", className,
                  "\n\tsheet:", sheetClassValue,
                  "\n\tnon-split option:", option);
            }
          }
        });
      } else if (typeof option === "function") {
        this._resolveVSSOption(
            localContext, engine, result, sheet, unthunkRepeat(option, localContext));
      } else if (option === null) {
        return null;
      } else if (typeof option !== "object") {
        console.warn(`Unrecognized VSS option`, option, "with sheet", sheet);
        throw new Error(`Unrecognized VSS option "${option}"`);
      } else if (Array.isArray(option)) {
        option.reduce((activeSheet, singularOption) => this._resolveVSSOption(
            localContext, engine, result, activeSheet, singularOption), sheet);
      } else {
        const newSheet = getImplicitMediaInterpretation(option, "VSS.option",
            { discourse: engine.discourse, contentType: "text/css" });
        return this.getVSSSheet(newSheet, localContext.reactComponent).classes;
      }
      return sheet;
    } catch (error) {
      throw wrapError(error, `During ${localContext.reactComponent.debugId()
              }\n ._resolveVSSOption:`,
          "\n\tcurrent option:", ...dumpObject(option),
          "\n\tcurrent sheet:", ...dumpObject(sheet));
    }
  }

  render () {
    const vFocus = (this.props.rootProps || {}).focus;
    if (!vFocus || !this._rootContext.frame) return null;
    const rootscopeProps = {
      ...(this.props.rootProps || {}),
      parentUIContext: this._rootContext,
      frameKey: "root",
    };
    const valoscope = <Valoscope {...rootscopeProps}>{this.props.children}</Valoscope>;
    return this.props.isRoot
        ? valoscope
        : (<div style={{ width: "100vw", height: "100vh" }}>{valoscope}</div>);
  }
}
