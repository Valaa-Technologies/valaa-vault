
import SimpleBar from "simplebar-react";

import ContextMenu from "./ContextMenu";
import ContextMenuTrigger, { DefaultContextMenuTrigger } from "./ContextMenuTrigger";
import ForEach from "./ForEach";
import If from "./If";
import GatewayStatus from "./GatewayStatus";
import MediaEditor from "./MediaEditor";
import TextFileEditor from "./TextFileEditor";
import UIComponent from "./UIComponent";
import Valoscope from "./Valoscope";

// List of Vidgets available for Editor JSX files

const Vidgets = {
  ContextMenu,
  ContextMenuTrigger,
  DefaultContextMenuTrigger,
  ForEach,
  If,
  GatewayStatus,
  InspireGatewayStatus: GatewayStatus,
  InspireClientStatus: GatewayStatus,
  MediaEditor,
  SimpleBar,
  TextFileEditor,
  UIComponent,
  ValaaScope: Valoscope,
  Valoscope,
  VScope: Valoscope,
};

export default Vidgets;
