
import SimpleBar from "simplebar-react";

import ContextMenu from "./ContextMenu";
import ContextMenuTrigger, { DefaultContextMenuTrigger } from "./ContextMenuTrigger";
// import ExpressionFieldEditor from "./ExpressionFieldEditor";
import ForEach from "./ForEach";
import If from "./If";
import GatewayStatus from "./GatewayStatus";
// import LinkFieldEditor from "./LinkFieldEditor";
import MediaEditor from "./MediaEditor";
// import TextFieldEditor from "./TextFieldEditor";
import TextFileEditor from "./TextFileEditor";
import UIComponent from "./UIComponent";
import UIContext from "./UIContext";
import Valoscope from "./Valoscope";

// List of Vidgets available for Editor JSX files

const Vidgets = {
  ContextMenu,
  ContextMenuTrigger,
  DefaultContextMenuTrigger,
//  ExpressionFieldEditor,
  ForEach,
  If,
  GatewayStatus,
  InspireGatewayStatus: GatewayStatus,
  InspireClientStatus: GatewayStatus,
//  LinkFieldEditor,
  MediaEditor,
  SimpleBar,
//  TextFieldEditor,
  TextFileEditor,
  UIComponent,
  UIContext,
//  ValaaNode,
  ValaaScope: Valoscope,
  Valoscope,
  VScope: Valoscope,
};

export default Vidgets;

export function registerVidgets () {
  for (const vidgetName of Object.keys(Vidgets)) {
    UIContext.registerBuiltinElement(vidgetName, Vidgets[vidgetName]);
  }
}
