// @flow
import React from "react";
import { ContextMenu, MenuItem, SubMenu } from "react-contextmenu";

import Vrapper, { getImplicitCallable } from "~/engine/Vrapper";

import UIComponent from "~/inspire/ui/UIComponent";
import VALEK from "~/engine/VALEK";

const ItemRelation : string = "Valaa_ContextMenu_Item";

export default class ValaaContextMenu extends UIComponent {
  bindSubscriptions (focus: any, props: Object) {
    super.bindSubscriptions(focus, props);
    // do magic
  }

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
    const itemRelations = focus.get(VALEK.relations(ItemRelation));
    return itemRelations.map((item, index) => {
      if (item.get(VALEK.relations(ItemRelation)).length) {
        return (
          <SubMenu
            title={item.get(VALEK.propertyValue("label"))}
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
          {item.get(VALEK.propertyValue("label"))}
        </MenuItem>
      );
    });
  }

  getMenuId (focus: any) {
    return `contextMenu_${focus.getRawId()}`;
  }

  makeClickCallback = (item: Vrapper) => {
    const callback = getImplicitCallable(item.get(VALEK.propertyValue("onClick")),
        "contextMenu.makeCallback.callback");
    if (!callback) return undefined;
    return (event, data, target) => callback(event.nativeEvent, data, target);
  }
}
