// @flow

import { Kuery } from "~/raem/VALK";

import Vrapper from "~/engine/Vrapper";
import { ValoscriptKuery, pointer as _pointer, literal } from "~/script/VALSK";

export function pointer (target: Kuery | Vrapper) {
  if (!(target instanceof Vrapper)) return _pointer(target);
  return { typeName: "Identifier", reference: target };
}

export { literal };

export default class EngineKuery extends ValoscriptKuery {
  fromValue (value: any, headType: ?string) {
    if (value instanceof Vrapper) return this.fromObject(value, headType);
    return super.fromValue(value, headType);
  }

  fromObject (object: any, headType: ?string) {
    return object instanceof Vrapper
        ? super.fromObject(object.getId(), object.getTypeName())
        : super.fromObject(object, headType);
  }

  tags (...additionalConditions: Kuery[]) {
    const tagsKuery = this.to("tags");
    return !additionalConditions.length ? tagsKuery
        : tagsKuery.filter((additionalConditions.length === 1)
            ? additionalConditions[0]
            : this._root.and(...additionalConditions));
  }

  listeners (name: any, ...additionalConditions: Kuery[]) {
    return this.to("listeners")
        .filter(this.hasName(name, ...additionalConditions));
  }

  // Relation helpers

  relations (name: any, ...additionalConditions: Kuery[]) {
    return this.to("relations")
        .filter(this.hasName(name, ...additionalConditions));
  }

  relationTargets (name: any, ...additionalConditions: Kuery[]) {
    return this.relations(name, ...additionalConditions)
        .map(this._root.to("target", "Relation"));
  }

  firstRelation (name: any, ...additionalConditions: Kuery[]) {
    return this.to("relations")
        .find(this.hasName(name, ...additionalConditions));
  }

  incomingRelations (name: any, ...additionalConditions: Kuery[]) {
    return this.to("incomingRelations")
        .filter(this.hasName(name, ...additionalConditions));
  }

  incomingRelationSources (name: any, ...additionalConditions: Kuery[]) {
    return this.incomingRelations(name, ...additionalConditions)
        .map(this._root.to("source", "Relation"));
  }

  firstIncomingRelation (name: any, ...additionalConditions: Kuery[]) {
    return this.to("incomingRelations")
        .find(this.hasName(name, ...additionalConditions));
  }

  // VALK Method ie. abstraction piercing, mutations, and extension and
  // integration access helpers. These structures are used to make
  // calls to Vrapper members and thus incite mutations.

  /**
   * To-step which sets the new head to true if current head has an
   * interface with given interfaceName. Requires VALSK.toMethod.
   *
   * Be mindful about the difference to VALK.typeof (and typeofEqualTo):
   * hasInterface at the moment only works in engine abstraction
   * piercing context and is only applicable for valos objects but can
   * be used to inspect any interfaces. typeof only returns "Resource"
   * "Data" or "Bvob" but can be used on any values.
   *
   * @param {Kuery} mutationKuery
   * @returns
   */
  hasInterface (interfaceName: string) {
    return this.call(this._root.toMethod("hasInterface"), null, interfaceName);
  }

  /**
   * A step which walks to the `typeName` generated field and returns
   * a comparison between that and the given type name.
   * @param {String} typeName
   */
  isOfType (typeName: string) {
    return this.to("typeName").equalTo(typeName);
  }


  /**
   * Creates or updates the given property with the given value
   * @param {string} propertyName
   * @param {Kuery} value
   * @param {Object} options
   */
  createOrUpdateProperty (propertyName: string, value: Kuery, options: Object = {}) {
    return this.if(
      this.propertyValueExpression(propertyName, { optional: true }).equalTo(null), {
        then: this._root.create("Property", {
          name: propertyName,
          value,
          owner: this
        }, { ...options, coupledField: "properties" }),
        else: this.modifyPropertyValue(propertyName, value, options)
      });
  }

  /**
   * Applies given valueModification to the value (of any type) of the Property with given
   * propertyName. The valk head for valueModification is the property resource.
   *
   * @param {string} propertyName
   * @param {Kuery} valueModification
   * @param {Object} [options={}]
   * @returns
   */
  modifyPropertyValue (propertyName: string, valueModification: any, options: Object = {}) {
    return this.property(propertyName).setField("value", valueModification, options);
  }

  /**
   * Applies given literalModification to the Literal value of a Property with given propertyName.
   *
   * If the literalModification is a Kuery the valk head for it is the value of the literal itself,
   * Otherwise the literalModification is just assigned as a new Literal value to the Property.
   *
   * @param {string} propertyName
   * @param {Kuery} literalModification
   * @param {Object} [options={}]
   */
  modifyPropertyLiteral (propertyName: string, literalModification: any, options: Object = {}) {
    return this.modifyPropertyValue(propertyName,
        literal(literalModification instanceof Kuery
            ? this._root.to("value").to("value").toTemplate(literalModification)
            : literalModification), options);
  }

  /**
   * Applies given targetModification to the Identifier value of a property with given
   * propertyName.
   *
   * If the targetModification is a Kuery the valk head for it is the current head (the owner of
   * the Property).
   * Otherwise the targetModification is assigned as a new Identifier value to the property.
   *
   * @param {string} propertyName
   * @param {Kuery} refModification
   * @param {Object} [options={}]
   */
  modifyPropertyTarget (propertyName: string, targetModification: any, options: Object = {}) {
    return this.modifyPropertyValue(propertyName,
        pointer(targetModification instanceof Kuery
            ? this._root.to("owner").to(targetModification)
            : targetModification), options);
  }

  modifyPropertyReference (propertyName: string, targetModification: any, options: Object = {}) {
    console.error("DEPRECATED: VALEK.modifyPropertyReference",
        "\n\tprefer: VALEK.modifyPropertyTarget");
    return this.modifyPropertyTarget(propertyName, targetModification, options);
  }

  setField (fieldName: string, value: Kuery, options: Object = {}) {
    return this.call(this._root.toMethod("setField"), null, fieldName, value, options);
  }

  addToField (fieldName: string, value: Kuery, options: Object = {}) {
    return this.call(this._root.toMethod("addToField"), null, fieldName, value, options);
  }

  removeFromField (fieldName: string, value: Kuery, options: Object = {}) {
    return this.call(this._root.toMethod("removeFromField"), null, fieldName, value, options);
  }

  create (typeName: string, initialState: Kuery, options: Object = {}) {
    return this.call(this._root.toMethod("create"), null, typeName, initialState, options);
  }

  duplicate (initialState: Kuery, options: Object = {}) {
    return this.call(this._root.toMethod("duplicate"), null, initialState, options);
  }

  instantiate (initialState: Kuery, options: Object = {}) {
    return this.call(this._root.toMethod("instantiate"), null, initialState, options);
  }

  destroy (options: Object = {}) {
    return this.call(this._root.toMethod("destroy"), null, options);
  }

  emplaceSetField (fieldName: string, initialState: Kuery, options: Object = {}) {
    return this.call(this._root.toMethod("emplaceSetField"), null, fieldName, initialState,
        options);
  }

  emplaceAddToField (fieldName: string, initialState: Kuery, options: Object = {}) {
    return this.call(this._root.toMethod("emplaceAddToField"), null,
        fieldName, initialState, options);
  }

  do (fieldName: string, initialState: Kuery, options: Object = {}) {
    return this.call(this._root.toMethod("do"), null, fieldName, initialState, options);
  }

  // Value container management

  extractValue (options: Object = {}) {
    return this.call(this._root.toMethod("extractValue"), null, options);
  }

  // Bvob and Media

  bvobContent (mediaVRL: ?any, remoteURL: ?any, options: Object = {}) {
    return this.call(this._root.toMethod("bvobContent"), null, mediaVRL, remoteURL, options);
  }

  blobContent (mediaVRL: ?any, remoteURL: ?any, options: Object = {}) {
    console.error("DEPRECATED: VALEK.blobContent\n\tprefer: VALEK.bvobContent");
    return this.call(this._root.toMethod("bvobContent"), null, mediaVRL, remoteURL, options);
  }

  mediaURL (options: Kuery = {}) {
    return this.call(this._root.toMethod("mediaURL"), null, options);
  }

  toMediaContentField () {
    return this.toField("content").or("sourceURL");
  }

  mediaContent (options: Kuery = {}) {
    return this.call(this._root.toMethod("mediaContent"), null, options);
  }

  interpretContent (options: Kuery = {}) {
    return this.call(this._root.toMethod("interpretContent"), null, options);
  }

  prepareBvob (bvobContent: any, options: Kuery = {}) {
    return this.call(this._root.toMethod("prepareBvob"), null, bvobContent, options);
  }

  prepareBlob (bvobContent: any, options: Kuery = {}) {
    console.error("DEPRECATED: VALEK.prepareBlob\n\tprefer: VALEK.prepareBvob");
    return this.call(this._root.toMethod("prepareBvob"), null, bvobContent, options);
  }

  // Locators

  recurseMaterializedFieldResources (fieldNames: Kuery, options: Kuery = {}) {
    return this.call(this._root.toMethod("recurseMaterializedFieldResources"), null,
        fieldNames, options);
  }

  recurseConnectedPartitionMaterializedFieldResources (fieldNames: Array<string>,
      options: Kuery = {}) {
    return this.call(this._root.toMethod("recurseConnectedPartitionMaterializedFieldResources"),
        null, fieldNames, options);
  }
}
