import wrapError, { dumpObject } from "~/tools/wrapError";

export default function createValidateEventMiddleware (validators) {
  const actionValidatorsByVersion = Object.entries(validators).reduce((acc, [version, byType]) => {
    acc[version] = validateAction;
    return acc;
    function validateAction (action) {
      try {
        if (!action.type) throw new Error(`Action has no type`);
        const typeValidator = byType[action.type];
        if (!typeValidator) {
          throw new Error(`INTERNAL ERROR: validator missing for type ${action.type}`);
        }
        const validatedAction = typeValidator(action, validateAction);
        if (!validatedAction || (typeof validatedAction !== "object")) {
          throw new Error(`Validator for ${action.type} returned a non-object`);
        }
        return validatedAction;
      } catch (error) {
        throw wrapError(error, `During validateAction, with:`,
            "\n\taction:", ...dumpObject(action));
      }
    }
  }, {});
  return (/* store */) => next => (event, ...rest: any[]) =>
      next(actionValidatorsByVersion[event.version](event), ...rest);
}
