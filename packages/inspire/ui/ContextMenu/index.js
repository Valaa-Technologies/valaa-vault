// @flow
import React from "react";
import { ContextMenu, MenuItem, SubMenu } from "react-contextmenu";

import Vrapper, { getImplicitCallable } from "~/engine/Vrapper";

import UIComponent from "~/inspire/ui/UIComponent";
import VALEK from "~/engine/VALEK";

const ItemRelation: string = "Valaa_ContextMenu_Item";
const toItemRelations = VALEK.relations(ItemRelation).setScopeAccesses(null);
const toLabel = VALEK.propertyValue("label").setScopeAccesses(null);
const toOnClick = VALEK.propertyValue("onClick").setScopeAccesses(null);

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
    const itemRelations = focus.step(toItemRelations);
    return itemRelations.map((item, index) => {
      if (item.step(toItemRelations).length) {
        return (
          <SubMenu
            title={item.step(toLabel)}
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
          {item.step(toLabel)}
        </MenuItem>
      );
    });
  }

  getMenuId (focus: any) {
    return `contextMenu_${focus.getRawId()}`;
  }

  makeClickCallback = (item: Vrapper) => {
    const callback = getImplicitCallable(item.step(toOnClick),
        "contextMenu.makeCallback.callback");
    if (!callback) return undefined;
    return (event, data, target) => callback(event.nativeEvent, data, target);
  }
}
