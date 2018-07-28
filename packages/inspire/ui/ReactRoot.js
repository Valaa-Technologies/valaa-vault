import React from "react";
import PropTypes from "prop-types";
import preset from "jss-preset-default";
import jss, { SheetsManager } from "jss";

import VALEK from "~/engine/VALEK";
import { getImplicitMediaInterpretation } from "~/engine/Vrapper";

import { uiComponentProps, VSSStyleSheetSymbol } from "~/inspire/ui/UIComponent";
import { unthunkRepeat } from "~/inspire/ui/thunk";
import vidgets from "~/inspire/ui";
import ValaaScope from "~/inspire/ui/ValaaScope";

import { dumpObject, invariantifyString, traverse, wrapError, valaaHash } from "~/tools";

jss.setup(preset());

const _sheetIds = new WeakMap();

export default class ReactRoot extends React.Component {
  static propTypes = {
    uiContext: PropTypes.object,
    children: PropTypes.object,
    vUIRoot: PropTypes.object,
    lensProperty: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]),
    // inspireCSS: PropTypes.object,
  };

  static childContextTypes = {
    engine: PropTypes.object,
    css: PropTypes.func,
    getVSSSheet: PropTypes.func,
    releaseVssSheets: PropTypes.func,
    lensContext: PropTypes.object,
    lensProperty: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]),
    lensPropertyNotFoundLens: PropTypes.any,
  };

  constructor (props, context) {
    super(props, context);
    this.cssRoot = {
      // Inspire: this.props.inspireCSS,
    };
  }

  getChildContext () {
    return {
      engine: this.props.vUIRoot.engine,
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
      lensContext: { ...vidgets, Math },
      lensProperty: this.props.lensProperty,
      lensPropertyNotFoundLens: undefined,
          // <div>No lens found in Valaa Resource named {VALEK.toField("name")}</div>
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
      sheetId = valaaHash(context);
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
        this._vssSheetUsers.set([...users.filter(u => u !== user)]);
      }
    }
  }

  _populateRootContext (rootContext: Object) {
    const reactRoot = this;
    rootContext.this = this;
    rootContext.VSS = function VSS (...rest: any[]) {
      try {
        const ret = { data: "" };
        const rootSheet = getImplicitMediaInterpretation(this[VSSStyleSheetSymbol],
            "VSS.rootStyleSheet", {
              transaction: reactRoot.props.vUIRoot.engine.discourse,
              mimeFallback: "text/css",
            });
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
            { transaction: this.props.vUIRoot.engine.discourse, mime: "text/css" });
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
    const vUIRoot = this.props.vUIRoot;
    if (!vUIRoot) return null;
    const rootContext = Object.create(this.props.uiContext || vUIRoot.getLexicalScope());
    this._populateRootContext(rootContext);
    return (
      <div style={{ width: "100vw", height: "100vh" }}>
        <ValaaScope
          {...uiComponentProps({ name: "root", parentUIContext: rootContext, focus: vUIRoot })}
        >
          {this.props.children}
        </ValaaScope>
      </div>);
  }
}
