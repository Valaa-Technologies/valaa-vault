exports.command = ".configure/.type/domain";
exports.describe = "Select 'domain' workspace type";
exports.introduction =
`A domain package provides a set of valma commands for defining and
managing a ValOS domain. Specific domain workspaces then:
1. shall provide domain package (de)registration via
   .configure/.<domain>/{,de}register-package
2. can provide new workspace types via .configure/.type/*
3. can provide new toolsets via
   .configure/{,.type/.<type>/,.domain/.<domain>/}.toolset/**/*

Notably the package (de)registration should provide means for any new
domain toolset packages to request the addition of their toolset
configure command to the domain domain.
Idiomatic way to implement this is a domain command which issues a PR
against the source control repository of the domain package.`;

exports.disabled = (yargs) => (yargs.vlm.getValOSConfig("type") !== "domain")
    && `Workspace is not a 'domain' (is '${yargs.vlm.getValOSConfig("type")}')`;
exports.builder = (yargs) => yargs.options({
  reconfigure: {
    alias: "r", type: "boolean",
    description: "Reconfigure all 'domain' configurations of this workspace.",
  },
});

exports.handler = (yargv) => ({
  devDependencies: { "@valos/type-domain": yargv.vlm.domainVersionTag("@valos/kernel") },
  toolsetsUpdate: { "@valos/type-domain": { inUse: "always" } },
  success: true,
});
