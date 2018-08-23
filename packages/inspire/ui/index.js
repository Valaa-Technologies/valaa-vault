
import ContextMenu from "./ContextMenu";
import ContextMenuTrigger, { DefaultContextMenuTrigger } from "./ContextMenuTrigger";
// import DraftEditor from "./DraftEditor";
// import ExpressionFieldEditor from "./ExpressionFieldEditor";
import ForEach from "./ForEach";
import If from "./If";
import InspireGatewayStatus from "./InspireGatewayStatus";
// import LinkFieldEditor from "./LinkFieldEditor";
import MediaEditor from "./MediaEditor";
// import TextFieldEditor from "./TextFieldEditor";
import TextFileEditor from "./TextFileEditor";
import UIComponent from "./UIComponent";
import UIContext from "./UIContext";
import ValaaScope from "./ValaaScope";

// List of Vidgets available for Editor JSX files

const Vidgets = {
  ContextMenu,
  ContextMenuTrigger,
  DefaultContextMenuTrigger,
//  DraftEditor,
//  ExpressionFieldEditor,
  ForEach,
  If,
  InspireGatewayStatus,
  InspireClientStatus: InspireGatewayStatus,
//  LinkFieldEditor,
  MediaEditor,
//  TextFieldEditor,
  TextFileEditor,
  UIComponent,
  UIContext,
//  ValaaNode,
  ValaaScope,
};

export default Vidgets;

export function registerVidgets () {
  for (const vidgetName of Object.keys(Vidgets)) {
    UIContext.registerBuiltinElement(vidgetName, Vidgets[vidgetName]);
  }
}
