export function _getIdentityRoles (router, identityChronicleURI) {
  let identityRoles = router._rolesByIdentity[identityChronicleURI];
  if (!identityRoles) {
    identityRoles = router._rolesByIdentity[identityChronicleURI] = {
      "": true,
      [identityChronicleURI]: true,
    };
  }
  return identityRoles;
}
