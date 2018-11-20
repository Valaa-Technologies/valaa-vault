import wrapError from "~/tools/wrapError";

export default function createValidateEventMiddleware (validators, defaultVersion: string,
    fixedVersion?: string) {
  const actionValidatorsByVersion = Object.entries(validators).reduce((acc, [version, byType]) => {
    // TODO(iridian): Add semver support for version restriction?
    if (!fixedVersion || (fixedVersion === version)) {
      acc[version] = validateAction;
    }
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
            "\n\taction:", JSON.stringify(action, null, 2));
      }
    }
  }, {});
  return (/* store */) => next => (event, ...rest: any[]) => {
    // kludge: raem shouldn't know about aspects, but then again, shouldn't know about versions
    // either.
    const version = (event.aspects && event.aspects.version) || event.version || defaultVersion;
    const versionValidator = actionValidatorsByVersion[version];
    if (!versionValidator) {
      throw new Error(`Could not find event validator for version ${version}`);
    }
    return next(versionValidator(event), ...rest);
  };
}
