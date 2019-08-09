/**
 * Returns the initial value for field to be set on creation. If not
 * specified the value will be left undefined in stores and
 * fieldFinalDefaultValue will be called on field resolve.
 *
 * @export
 * @param {any} field
 * @returns
 */
export default function fieldInitialValue (field) {
  return field.initialValue;
}
