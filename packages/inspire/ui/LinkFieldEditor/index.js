// @flow
import React from "react";
import PropTypes from "prop-types";

import UIComponent from "~/inspire/ui/UIComponent";
import { unthunkRepeat } from "~/inspire/ui/thunk";
import FieldEditor from "~/inspire/ui/FieldEditor";
import VALEK, { Kuery, pointer } from "~/engine/VALEK";
import Vrapper, { LiveUpdate } from "~/engine/Vrapper";

import { dumpObject, thenChainEagerly, wrapError } from "~/tools";

export default class LinkFieldEditor extends UIComponent {
  static _defaultPresentation = () => unthunkRepeat(require("./presentation").default);
  static propTypes = {
    ...FieldEditor.propTypes,
    fieldName: PropTypes.string,
    toCandidatesKuery: PropTypes.instanceOf(Kuery).isRequired,
  };
  static noPostProcess = {
    ...UIComponent.noPostProcess,
    toCandidatesKuery: true,
  }

  bindFocusSubscriptions (focus: any, props: Object) {
    super.bindFocusSubscriptions(focus, props);

    thenChainEagerly(null, [
      this.bindLiveKuery.bind(this, `LinkFieldEditor_fieldName`,
          focus, VALEK.to(props.fieldName),
          { asRepeathenable: true, scope: this.getUIContext() }),
      this.onValueUpdate,
    ], errorOnLinkFieldEditorSubscriptions.bind(this, "LinkFieldEditor_fieldName"));

    thenChainEagerly(null, [
      () => {
        const focusTypeName = focus.tryTypeName();
        let binding, kuery;
        if (focusTypeName === "Property") {
          // Property case:
          // TODO: (thiago) Fix bug that causes the toCandidatesKuery
          // to return OrderedMap structures
          // const entries = this.getFocus().do(
          //    VALEK.to(nextProps.toCandidatesKuery).nullable(),
          //    { scope: this.getUIContext() });
          //
          binding = `LinkFieldEditor_Property_target`;
          kuery = VALEK.to(props.fieldName).nullable()
              .if(VALEK.isOfType("Identifier"), { then: VALEK.to("reference").nullable() });
        } else if (focusTypeName === "Relation") {
          binding = `LinkFieldEditor_Relation_target`;
          kuery = VALEK.to(props.fieldName).nullable();
        } else return undefined;
        return this.bindLiveKuery(binding, focus, kuery,
            { asRepeathenable: true, scope: this.getUIContext() });
      },
      this.refreshNameSubscriber,
    ], errorOnLinkFieldEditorSubscriptions.bind(this, "LinkFieldEditor_target"));

    thenChainEagerly(null, [
      this.bindLiveKuery.bind(this, `LinkFieldEditor_Candidates`,
          focus, VALEK.to(props.toCandidatesKuery).nullable().filter(VALEK.isTruthy()),
          { asRepeathenable: true, scope: this.getUIContext() }),
      this.onCandidatesUpdate,
    ], errorOnLinkFieldEditorSubscriptions.bind(this, "LinkFieldEditor_Candidates"));

    function errorOnLinkFieldEditorSubscriptions (name, error) {
      throw wrapError(error, new Error(`${this.debugId()}\n .bindFocusSubscriptions.${
              name}, with:`),
          "\n\tfocus:", ...dumpObject(focus),
          "\n\tprops:", ...dumpObject(props),
          "\n\tthis:", ...dumpObject(this));
    }
  }

  refreshNameSubscriber = (liveUpdate: LiveUpdate) => {
    if (!liveUpdate) return;
    let target = liveUpdate.value();
    if (!(target instanceof Vrapper) || !(target.isActive() || target.isActivating())) {
      target = undefined;
    }
    this.bindLiveKuery(`LinkFieldEditor_target_name`,
        target, VALEK.to("name").nullable(),
        { scope: this.getUIContext(), onUpdate: this.refresh, updateImmediately: false });
  }

  refresh = () => {
    this.forceUpdate();
  }

  onValueUpdate = (liveUpdate: LiveUpdate) => {
    const updateValue = liveUpdate.value();
    let typeName;
    try {
      if (!updateValue) {
        this.setState({ value: undefined });
      } else {
        let value;
        if (!(updateValue instanceof Vrapper)) {
          typeName = updateValue.typeName;
        } else if (updateValue.isActive()) {
          typeName = updateValue.tryTypeName();
        } else {
          value = updateValue;
        }
        if (!value) {
          switch (typeName) {
            case "Literal":
              value = updateValue.value;
              break;
            case "Identifier":
              value = this.getFocus().get(VALEK.to(this.props.fieldName)
                  .to("reference", "Identifier"));
              break;
            case "Entity":
              value = this.getFocus().get(VALEK.to(this.props.fieldName).to("id", "Resource"));
              break;
            default:
              if (updateValue.hasInterface("Discoverable")) {
                value = this.getFocus().get(VALEK.to(this.props.fieldName));
              } else {
                throw new Error(`Cannot determine LinkFieldEditor target value because it is not ${
                    ""}an Identifier, Entity or Discoverable: got ${typeName}`);
              }
          }
        }
        this.setState({ value });
      }
    } catch (error) {
      throw wrapError(error, `During ${this.debugId()}\n .onValueUpdate(), with:`,
          "\n\tupdate:", ...dumpObject(liveUpdate),
          "\n\tupdateValue:", ...dumpObject(updateValue),
          "\n\ttypeName:", typeName);
    }
  }

  onCandidatesUpdate = (liveUpdate: LiveUpdate) => {
    const entries = liveUpdate.value();

    this.entryMap = {};
    for (const entry of entries) {
      const key = `${entry.get("typeName")} ${entry.get("name")}`;
      this.entryMap[key] = entry;
    }

    this.entryList = Object.keys(this.entryMap).sort();
    this.forceUpdate();
  }

  preRenderFocus () {
    const dataListID = `datalist_${this.getFocus().getRawId()}`;
    return (
      <div>
        <input
          {...this.presentation("linkFieldEditor")}
          key={`linkFieldEditor_${this.getFocus().getRawId()}`}
          type="text"
          list={dataListID}
          value={this.shownValue()}
          onKeyDown={this.onKeyDown}
          onKeyUp={this.onKeyUp}
          onChange={this.onChange}
          onBlur={this.onBlur}
          onDoubleClick={this.stopPropagation}
        />
        {this.getDataList(dataListID)}
      </div>
    );
  }

  shownValue () {
    if (this.state.pending) return this.state.pending;
    if (this.state.value) {
      const value = this.state.value;
      if (!value.isActive()) return `<${value.getPhase()} '${value.getRawId()}'>`;
      return `${value.get("typeName")} ${value.get("name")}`;
    }
    return "null";
  }

  getDataList (dataListID: string) {
    if (!this.entryList) return null;
    return (
      <datalist id={dataListID} key={dataListID}>
        {this.getDataListOptions()}
      </datalist>
    );
  }

  getDataListOptions () {
    // eslint-disable-next-line react/no-array-index-key
    return this.entryList.map((entry, index) => <option key={index} value={entry} />);
  }

  onKeyDown = (event: Event) => {
    if (event.key === "Enter") {
      this.enterPressed = true;
      event.target.blur();
    }
  }

  onKeyUp = (event: Event) => {
    if (event.key === "Escape" || event.key === "Esc") {
      this.canceling = true;
      event.target.blur();
      event.stopPropagation();
    }
  }

  onChange = (event: Event) => {
    this.setState({ pending: event.target.value });
    event.stopPropagation();
  }

  onBlur = (event: Event) => {
    event.stopPropagation();
    if (!this.entryMap || !this.entryMap[event.target.value]) {
      this.setState({ value: undefined });
      return;
    }
    this.saveValue(this.entryMap[event.target.value]);
  }

  saveValue (value: Object) {
    if (this.canceling) this.canceling = false;
    else this.getFocus().setField(this.props.fieldName, pointer(value));
    this.setState({ pending: undefined });
  }

  stopPropagation = (event: Event) => { event.stopPropagation(); }
}
