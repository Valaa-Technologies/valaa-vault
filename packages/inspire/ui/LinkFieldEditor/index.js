// @flow
import React from "react";
import PropTypes from "prop-types";

import UIComponent from "~/inspire/ui/UIComponent";
import Presentable from "~/inspire/ui/Presentable";
import FieldEditor from "~/inspire/ui/FieldEditor";
import VALEK, { Kuery, pointer } from "~/engine/VALEK";
import Vrapper, { LiveUpdate } from "~/engine/Vrapper";

import { dumpObject, wrapError } from "~/tools";

export default @Presentable(require("./presentation").default, "LinkFieldEditor")
class LinkFieldEditor extends UIComponent {
  static propTypes = {
    ...FieldEditor.propTypes,
    fieldName: PropTypes.string,
    toCandidatesKuery: PropTypes.instanceOf(Kuery).isRequired,
  };
  static noPostProcess = {
    ...UIComponent.noPostProcess,
    toCandidatesKuery: true,
  }

  bindSubscriptions (focus: any, props: Object) {
    try {
      super.bindSubscriptions(focus, props);

      this.bindNewKuerySubscription(`LinkFieldEditor_fieldName`,
          focus, VALEK.to(props.fieldName), { scope: this.getUIContext() },
          this.onValueUpdate);

      // Property case:
      if (focus.tryTypeName() === "Property") {
        this.bindNewKuerySubscription(`LinkFieldEditor_Property_target`,
            focus, VALEK.to(props.fieldName).nullable()
                .if(VALEK.isOfType("Identifier"), { then: VALEK.to("reference").nullable() }),
            { scope: this.getUIContext() },
            this.refreshNameSubscriber);
      }

      // Relations case:
      if (focus.tryTypeName() === "Relation") {
        this.bindNewKuerySubscription(`LinkFieldEditor_Relation_target`,
            focus, VALEK.to(props.fieldName).nullable(), { scope: this.getUIContext() },
            this.refreshNameSubscriber);
      }

      // TODO: (thiago) Fix bug that causes the toCandidatesKuery to return OrderedMap structures
      // const entries = this.getFocus().do(
      //    VALEK.to(nextProps.toCandidatesKuery).nullable(),
      //    { scope: this.getUIContext() });
      //
      // Hack: Workaround to unfiltered results leaking OrderedMap structures
      this.bindNewKuerySubscription(`LinkFieldEditor_Candidates`,
          focus, VALEK.to(props.toCandidatesKuery).nullable().filter(VALEK.isTruthy()),
          { scope: this.getUIContext() },
          this.onCandidatesUpdate);
    } catch (error) {
      throw wrapError(error, `During ${this.debugId()}\n .bindSubscriptions(), with:`,
          "\n\thead:       ", focus,
          "\n\tthis:       ", this);
    }
  }

  refreshNameSubscriber = (liveUpdate: LiveUpdate) => {
    let target = liveUpdate.value();
    if (!(target instanceof Vrapper) || !(target.isActive() || target.isActivating())) {
      target = undefined;
    }
    this.bindNewKuerySubscription(`LinkFieldEditor_target_name`,
        target, VALEK.to("name").nullable(), { scope: this.getUIContext() },
        this.refresh);
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
