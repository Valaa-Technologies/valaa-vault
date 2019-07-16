import React from "react";
import PropTypes from "prop-types";
import preset from "jss-preset-default";
import jss, { SheetsManager } from "jss";

import { naiveURI } from "~/raem/ValaaURI";

import Vrapper, { getImplicitMediaInterpretation } from "~/engine/Vrapper";

import { uiComponentProps, VSSStyleSheetSymbol } from "~/inspire/ui/UIComponent";
import { unthunkRepeat } from "~/inspire/ui/thunk";
import Valoscope from "~/inspire/ui/Valoscope";
import { VS } from "~/engine/VALEK";

import { derivedId, dumpObject, invariantifyString, traverse, wrapError, valosHash } from "~/tools";

jss.setup(preset());

const _sheetIds = new WeakMap();

export default class ReactRoot extends React.Component {
  static propTypes = {
    viewName: PropTypes.string,
    children: PropTypes.object,
    vViewFocus: PropTypes.object,
    lensProperty: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]),
  };

  static childContextTypes = {
    engine: PropTypes.object,
    css: PropTypes.func,
    getVSSSheet: PropTypes.func,
    releaseVssSheets: PropTypes.func,
    lensProperty: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]),
    lensPropertyNotFoundLens: PropTypes.any,
  };

  constructor (props, context) {
    super(props, context);
    this.cssRoot = {};
    if (props.vViewFocus) {
      this._createRootContext(props.vViewFocus, props.viewName)
      .then(rootContext => {
        this._rootContext = rootContext;
        this.forceUpdate();
      });
    }
  }

  getChildContext () {
    return {
      engine: (this.props.vViewFocus || {}).engine,
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
      lensProperty: this.props.lensProperty,
    };
  }

  componentWillMount () {
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

  async _createRootContext (vViewFocus: Vrapper, viewName: string) {
    const rootContext = Object.create(vViewFocus.engine.getLexicalScope());
    const valos = rootContext.valos;
    rootContext.frame = await this._obtainUIRootFrame(
        rootContext[valos.Lens.shadowLensAuthority], vViewFocus, viewName);
    rootContext[valos.Lens.scopeFrameResource] = rootContext.frame;
    rootContext.VSS = this._createVSS(vViewFocus.engine);
    rootContext.VS = VS;
    return rootContext;
  }

  async _obtainUIRootFrame (partitionAuthorityURI: string, vViewFocus: Vrapper, viewName: string) {
    const localInstanceRawId = derivedId(vViewFocus.getRawId(), "LOCAL-UIROOT-PARTITION", viewName);
    const partitionURI = naiveURI.createPartitionURI(partitionAuthorityURI, localInstanceRawId);
    await vViewFocus.engine.discourse
        .acquireConnection(partitionURI)
        .asActiveConnection();
    let vLocalUIRoot = vViewFocus.engine.getVrapperByRawId(localInstanceRawId, { optional: true });
    if (!vLocalUIRoot) {
      vLocalUIRoot = await vViewFocus.engine.create("Entity", {
        id: localInstanceRawId, owner: null,
        name: `Local UI root view '${viewName}' to '${vViewFocus.debugId()}'`,
        partitionAuthorityURI,
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
            "VSS.rootStyleSheet", { mimeFallback: "text/css", discourse: engine.discourse });
        const contextSheet = rootSheet
            && reactRoot.getVSSSheet(rootSheet, this.reactComponent).classes;
        reactRoot._resolveVSSOption(this, ret, contextSheet, rest);
        return ret.data;
      } catch (error) {
        throw wrapError(error, `During ${this.reactComponent.debugId()}\n .VSS:`,
            "\n\targs:", ...rest,
            "\n\tprops:", this.reactComponent.props,
            "\n\tstate:", this.reactComponent.state);
      }
    };
  }

  _resolveVSSOption (localContext: Object, result: Object, sheet: ?Object, option: any) {
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
        this._resolveVSSOption(localContext, result, sheet, unthunkRepeat(option, localContext));
      } else if (option === null) {
        return null;
      } else if (typeof option !== "object") {
        console.warn(`Unrecognized VSS option`, option, "with sheet", sheet);
      } else if (Array.isArray(option)) {
        option.reduce((activeSheet, singularOption) =>
            this._resolveVSSOption(localContext, result, activeSheet, singularOption), sheet);
      } else {
        const newSheet = getImplicitMediaInterpretation(option, "VSS.option",
            { discourse: this.props.vViewFocus.engine.discourse, mime: "text/css" });
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
    const vViewFocus = this.props.vViewFocus;
    if (!vViewFocus || !this._rootContext) return null;
    return (
      <div>
        <Valoscope
          {...uiComponentProps({
            name: "root", parentUIContext: this._rootContext, focus: vViewFocus,
          })}
        >
          {this.props.children}
        </Valoscope>
      </div>
    );
  }
}
