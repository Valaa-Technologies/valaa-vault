// @flow
import React from "react";
import { ContextMenu, MenuItem, SubMenu } from "react-contextmenu";

import Vrapper, { getImplicitCallable } from "~/engine/Vrapper";

import UIComponent from "~/inspire/ui/UIComponent";
import VALEK from "~/engine/VALEK";

const ItemRelation: string = "Valaa_ContextMenu_Item";

export default class ValaaContextMenu extends UIComponent {
  preRenderFocus (focus: any) {
    return (
      <ContextMenu
        id={this.getMenuId(focus)}
        className={this.props.menuClass}
      >
        {this.getItems(focus)}
      </ContextMenu>
    );
  }

  getItems (focus: any) {
    const itemRelations = focus.step(VALEK.relations(ItemRelation));
    return itemRelations.map((item, index) => {
      if (item.step(VALEK.relations(ItemRelation)).length) {
        return (
          <SubMenu
            title={item.step(VALEK.propertyValue("label"))}
            className={this.props.menuClass}
            // TODO(iridian): Legacy code, should remove once no longer needed by zero
            key={index} // eslint-disable-line react/no-array-index-key
          >
            {this.getItems(item)}
          </SubMenu>
        );
      }
      return (
        <MenuItem
          onClick={this.makeClickCallback(item)}
          attributes={{ className: this.props.itemClass }}
          key={index} // eslint-disable-line react/no-array-index-key
        >
          {item.step(VALEK.propertyValue("label"))}
        </MenuItem>
      );
    });
  }

  getMenuId (focus: any) {
    return `contextMenu_${focus.getRawId()}`;
  }

  makeClickCallback = (item: Vrapper) => {
    const callback = getImplicitCallable(item.step(VALEK.propertyValue("onClick")),
        "contextMenu.makeCallback.callback");
    if (!callback) return undefined;
    return (event, data, target) => callback(event.nativeEvent, data, target);
  }
}
