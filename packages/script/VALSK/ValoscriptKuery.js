// @flow

import { Kuery } from "~/raem/VALK";

export const ScopeAccessesTag = Symbol("VALSK.ExternalScopeAccess");

export default class ValoscriptKuery extends Kuery {
  /**
   * Do-step which valks the statement steps, discards their results while keeping the head as the
   * current head. Updates the valking state of the valker after each statement.
   *
   * @param {Object} statement
   * @returns {Kuery}
   */
  doStatements (...statements: Kuery[]) {
    return this._addExpression("§@", statements.map(statement => this._root.to(statement)));
  }

  fromThis () { return this.fromScope("this"); }

  withName (name: any, ...additionalConditions: Kuery[]) {
    console.error("DEPRECATED: VALSK.withName\n\tprefer: VALEK.hasName");
    return this.hasName(name, ...additionalConditions);
  }

  hasName (name: any, ...additionalConditions: Kuery[]) {
    const ret = (name !== undefined)
        ? this._root.to("name").equalTo(name)
        : this._root;
    return additionalConditions.length
        ? ret.and(...additionalConditions)
        : ret.isActiveKuery() ? ret
        : ret.fromValue(true);
  }

  // Property value helpers


  /**
   * Creates a new mutable native property with given value as the new head.
   *
   * @param {*} [value=VALSK.void()]
   * @returns
   *
   * @memberof ValoscriptKuery
   */
  createLetIdentifier (value: any = this._root.void()) {
    return this._addExpression("§let$$", [value]);
  }

  /**
   * Creates a new immutable native property with given value as the new head.
   *
   * @param {*} [value=VALSK.void()]
   * @returns
   *
   * @memberof ValoscriptKuery
   */
  createConstIdentifier (value: any = this._root.void()) {
    return this._addExpression("§const$$", [value]);
  }

  /**
   * To-step expression which retrieves the given property of given container as the new head.
   * If container is omitted it defaults to head.
   * This step interprets the container as follows to retrieve the property:
   * 1. If the container is a host object, a host call to "propertyValue" made with the
   *    propertyName as parameter and its return value is set as new head,
   * 2. otherwise the container must be a plain native object and a basic native lookup using
   *    [propertyName] is made. If this resolves into value that was not created using
   *    createNativeIdentifier it is directly set as new head,
   * 3. otherwise the value which was given to createNativeIdentifier is set as the new head.
   *
   * @export
   * @param {string} memberName
   * @param {Kuery} [head=VALEK]
   * @returns
   */
  propertyValue (propertyName: any, toContainer: ?any) {
    return this._addExpression("§..", [
      propertyName,
      ...(typeof toContainer !== "undefined" ? [this._root.to(toContainer)] : [])
    ]);
  }


  /**
   * To-step which retrieves the given identifier from given scope as the new head.
   * If toScope is omitted it defaults to the current scope.
   * Behaves like propertyValue, except if the identifier is not found raises an exception.
   *
   * @param {*} toIdentifierName
   * @param null toScope
   * @param {any} any
   * @returns
   *
   * @memberof ValoscriptKuery
   */
  identifierValue (identifierName: any, toScope: ?any) {
    return this._addExpression("§$$", [
      identifierName,
      ...(typeof toScope !== "undefined" ? [this._root.to(toScope)] : [])
    ]);
  }

  /**
   * Like propertyValue but changes the property value instead, valking given alteration against
   * the value as head to get the altered value. This altered value is stored so that further
   * propertyValue calls will return the altered value. The altered value is then set as the new
   * head.
   *
   * A host object update is performed using "alterProperty" with toPropertyName, toAlterationVAKON
   * and the options as arguments.
   *
   * @param {*} container
   * @param {*} toPropertyName
   * @param {*} alteration
   * @param null options
   * @param {any} Object
   * @returns
   */
  alterProperty (propertyName: any, toAlterationVAKON: any, toContainer: ?any) {
    return this._addExpression("§..<-", [
      propertyName,
      this._root.to(toAlterationVAKON),
      ...(typeof toContainer === "undefined" ? [] : [this._root.to(toContainer)]),
    ]);
  }

  alterIdentifier (identifierName: any, toAlterationVAKON: any, toScope: ?any) {
    return this._addExpression("§$$<-", [
      identifierName,
      this._root.to(toAlterationVAKON),
      ...(typeof toScope === "undefined" ? [] : [this._root.to(toScope)]),
    ]);
  }

  /**
   * Like propertyValue but deletes the property value instead based on its host-specific deletion
   * semantics.
   *
   * @param {*} container
   * @param {*} toPropertyName
   * @param {*} alteration
   * @param null options
   * @param {any} Object
   * @returns
   */
  deleteProperty (propertyName: any, toContainer: ?any) {
    return this._addExpression("§delete..", [
      propertyName,
      ...(typeof toContainer === "undefined" ? [] : [this._root.to(toContainer)]),
    ]);
  }


  /**
   * Deletes an identifier it was introduced without var/let/const specification, ie. if it is a
   * global scope host object property.
   *
   * Ironically this means that native properties created using §let$$ cannot be deleted using
   * §delete$$
   *
   * @param {*} identifierName
   * @param null toScope
   * @param {any} any
   * @returns
   *
   * @memberof ValoscriptKuery
   */
  deleteIdentifier (identifierName: any, toScope: ?any) {
    return this._addExpression("§delete$$", [
      identifierName,
      ...(typeof toScope === "undefined" ? [] : [this._root.to(toScope)]),
    ]);
  }

  // Property helpers

  property (name: string) {
    return this.to("properties").find(this.hasName(name));
  }

  toValue (options: { optional?: boolean, ownerName?: string }) {
    const afterCheck = (options && options.optional)
        ? this.nullable()
        : this.notNull(`${(options && options.ownerName) || "owner of field 'value'"} is missing`);
    return afterCheck.to("value");
  }

  toLiteral (options: { optional?: boolean, ownerName?: string }) {
    const afterCheck = (!options || !options.optional)
        ? this.notNull(`${(options && options.ownerName) || "head"
            } is falsy, expected Literal`)
        : this.nullable().if(this._root.isOfType("Literal")).nullable();
    return afterCheck.to("value", "Literal");
  }

  toTarget (options: { optional?: boolean, ownerName?: string }) {
    const afterCheck = (!options || !options.optional)
        ? this.notNull(`${(options && options.ownerName) || "field 'value'"
            } is falsy, expected Identifier`)
        : this.nullable().if(this._root.isOfType("Identifier")).nullable();
    return afterCheck.to("reference", "Identifier");
  }

  propertyValueExpression (name: string, options: { optional?: boolean, ownerName?: string } = {}) {
    if (!options.ownerName) options.ownerName = `property '${name}'`;
    return this.property(name).toValue(options);
  }

  toValueLiteral (options: { optional?: boolean, ownerName?: string }) {
    return this.toValue(options).toLiteral(options);
  }

  toValueTarget (options: { optional?: boolean, ownerName?: string }) {
    return this.toValue(options).toTarget(options);
  }

  propertyLiteral (name: string, options: { optional?: boolean, ownerName?: string } = {}) {
    if (!options.ownerName) options.ownerName = `property '${name}'`;
    return this.property(name).toValueLiteral(options);
  }

  propertyTarget (name: string, options: { optional?: boolean, ownerName?: string } = {}) {
    if (!options.ownerName) options.ownerName = `property '${name}'`;
    return this.property(name).toValueTarget(options);
  }

  propertyReference (name: string, options: { optional?: boolean }) {
    console.error("DEPRECATED: VALSK.propertyReference\n\tprefer: VALEK.propertyTarget");
    return this.propertyTarget(name, options);
  }

  /**
   * Host to-step which retrieves the host callable with given *callName* from the current head
   * and sets the resulting native do-op function as the new head.
   * The current head must be a host object.
   *
   * Corresponds to VAKON statement operator:
   *   ["§method", valueVAKON(callableName)]
   * @param {Object} statement
   * @returns {Kuery}
   */
  toMethod (callName: string) {
    return this._addExpression("§method", [callName]);
  }

  method (methodName: string) {
    console.error("DEPRECATED: VALK.method\n\tprefer: VALK.toMethod");
    return this.toMethod(methodName);
  }

  /**
   * To-step which tests whether valking toTest against current head is truthy (without setting new
   * head) and if so, valks toStep as new head. This process is repeated until toStep valk is falsy.
   *
   * @param {*} toTest
   * @param {*} toStep default is no-op ie. VALSK.head().
   * @returns
   *
   * @memberof ValoscriptKuery
   */
  while (toTest: any, toStep: ?any) {
    return this._addExpression("§while", [
      this._root.to(toTest),
      ...(typeof toStep !== "undefined" ? [this._root.to(toStep)] : []),
    ]);
  }
}
