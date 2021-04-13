
const {
  extractee: {
    c, em, ref, cli, command, cpath, bulleted,
    authors, pkg,
  },
} = require("@valos/revdoc");

const { name, version, description, valos: { type } = {} } = require("./package");

const title = "ValOSP Authority";

module.exports = {
  "dc:title": title,
  "VRevdoc:package": name,
  "VRevdoc:version": version,
  respecConfig: {
    specStatus: "unofficial",
    shortName: "valospAuthority",
    editors: authors("iridian"),
    authors: authors("iridian"),
  },
  "chapter#abstract>0": {
    "#0": [
`@valos/authority-spindle is a `, ref("perspire worker", "@valos/inspire#perspire"),
` plugin that implements a `, ref("valosp: scheme", "@valos/sourcerer#valosp"),
` authority as a set of `, ref("@valos/web-spindle"), ` routes.`,
    ],
  },
  "chapter#sotd>1": {
    "#0": [
`This document is part of the spindle workspace `, pkg("@valos/authority-spindle"), `
(of domain `, pkg("@valos/kernel"), `) which has the description:
\`${description}\`.`,
    ],
  },
  "chapter#introduction>2": {
    "#0": [
`Edit me - this is the first payload chapter. Abstract and SOTD are
essential `, ref("ReSpec boilerplate",
    "https://github.com/w3c/respec/wiki/ReSpec-Editor's-Guide#essential-w3c-boilerplate"), `

See `, ref("ReVDoc tutorial", "@valos/revdoc/tutorial"), ` for
instructions on how to write revdoc source documents.

See also `, ref("ReVdoc specification", "@valos/revdoc"), ` and `,
ref("VDoc specification", "@valos/vdoc"), ` for reference documentation.`,
    ],
  },
  "chapter#section_setup>2;Setting up the authority perspire server": {
    "#0": [
`Goal is to create and populate a directory as an npm workspace so that
executing `, command("vlm perspire"), ` in it will launch a https
server as a node process. `, em(`node`), " and ", em("npm"), " (or ", em("yarn"),
`) are required as global CLI dependencies.

Additionally, the `, ref([`valos manager tool `, command("vlm")],
"https://www.npmjs.com/package/valma"),
` and the `, ref("@valos/kernel"), ` domain need to be installed globally:`,
cli("sudo npm install -g valma @valos/kernel"),
null,
`Once installed, create a new directory (example directory below is `, em('"taur"'),
`) and start the interactive session to initialize the workspace:`,
cli("vlm init"),
`We will use this tool to create a `, ref("worker", "@valos/kernel#worker"),
` workspace without a domain and with `, ref("@valos/web-spindle"), " and ",
ref("@valos/authority-spindle"), ` toolsets.`,
cli("? Set 'vault' as the valos.type (workspace is outside a vault)? (y/N)",
    "  No"),
`After answering, `, em("vlm"), ` will echo the internal commands it
performs like so:`,
cli("      [1] >> [2] vlm .configure/.valos-stanza",
    "          [2] >> [3] vlm '.select/.domain/**/*' --show-name --show-description",
    `          [2] << [3] vlm '.select/.domain/**/*': [{"...":{"columns":[["name",{"text...`),
`The echos are omitted for the rest of this guide. Now let's choose no
domain and type to be `, em("worker"), ".",
cli("? Choose a package.json:valos.domain for the new workspace",
    "❯ <no domain>   - <this workspace is not part of a domain>"),
cli("? Choose a package.json:valos.type for the new workspace",
    "❯ worker         - Execute perspire gateway as a Node.js process in this workspace"),
cli("? Confirm package.json:valos.type choice: 'worker'? (Y/n)",
    "  Yes"),
`At this point `, command("vlm init"), ` asks to delegate package.json
initialization to `, command("yarn init"), `. We accept defaults if
available and give sane values otherwise.`,
cli("? Initialize package.json with 'yarn init'?",
    "❯ Initialize"),
cli(command("yarn init v1.21.1"),
    "question name (taur-worker):",
    "question version (0.1.0): 0.1.0",
    "question description: Test authority",
    "question entry point (index.js):",
    "question repository url:",
    "question author: Iridian",
    "question license (MIT):",
    "question private (true):"),
`Verify that the domain @valos/kernel is visible as it is the origin of `,
ref("@valos/web-spindle"), " and ", ref("@valos/authority-spindle"),
` toolsets (among other things). We don't need to add other domains, so
we bypass adding them.`,
cli("[1] init informs: Visible domains:",
    "package      |version            |pool  ",
    "-------------|-------------------|------",
    "@valos/kernel|0.37.0-prerelease.0|global"),
cli("? yarn add more domains as devDependencies directly to this workspace?",
    "❯ Bypass"),
cli(`? Commit package.json valos stanza: {"type":"worker","domain":""}?`,
    "❯ Commit"),
`At this point `, command("vlm init"), ` makes the first of several calls to `,
command("yarn init"), `. These separate calls are necessary as they
bring in initialization and configuration code for subsequent stages.`,
cli("      [1] >> [4] vlm @ yarn add --dev @valos/type-worker@>=0.37.0-prerelease.0",
    "yarn add v1.21.1",
    "success Saved lockfile.",
    "success Saved 224 new dependencies.",
    "info Direct dependencies",
    "└─ @valos/type-worker@0.37.0-prerelease.0",
    "info All dependencies",
    "└─ ...",
    "Done in 38.60s."),
`At this point the init is complete and we proceed to configuring the
workspace. The command `, command(`vlm configure --reconfigure`),
` can always be manually re-executed from the CLI if something goes
wrong after this point.`,
cli("? Configure workspace with 'vlm configure --reconfigure'?",
    "❯ Configure"),
`Leave service chronicle URI empty. The basic authority setup does not
involve any custom service logic.`,
cli("? The service chronicle URI"),
`Always select copy-templates-files when given the option`,
// TODO(iridian, 2021-04): We should evaluate whether this should
// optional to begin with for authority setups. That said, there's no
// mechanism to mark it automatic (yet).
cli("? Pick tools selection choices for the toolset '@valos/type-worker'",
    "◉ copy-template-files - Copy toolset template files to the workspace"),
`Now we get to select the toolsets we want. We need to manually install
web-spindle only first as authority-spindle depends on it (and
unfortunately automated dependency ordering is not implemented yet)`,
cli("? Pick toolsets selection choices for the workspace",
    "◯ @valos/authority-spindle - Host a standalone authority using web-spindle route projectors",
    "◉ @valos/web-spindle       - Project http/s requests to valospace-fabric via a gateway plugin",
    `◯ @valos/toolset-revealer  - ${
      ""}Run 'vlm rouse-revealer' to serve local inspire sites with webpack-dev-server`,
    `◯ @valos/type-toolset      - ${
      ""}Make current workspace selectable as a toolset for other workspaces`),
cli(`[13] >> [18] vlm @ yarn add --dev @valos/web-spindle@>=0.37.0-prerelease.0`,
    "yarn add v1.21.1",
    "...",
    "Done in 12.25s."),
`We configure the web-spindle to have SSL enabled at `, em("localhost"),
` port 5443 and choose to have `, command("openssl"), ` to create
insecure self-signed certificates for testing our authority.`,
cli("? Enable SSL", "  True"),
cli("? The port the Web API listens.", "  5443"),
cli("? The local address the Web API is bound to.", "  localhost"),
cli("? Pick tools selection choices for the toolset '@valos/web-spindle'",
    "◉ copy-template-files - Copy toolset template files to the workspace"),
cli("? Use 'openssl' to create insecure self-signed placeholder certificates?", "Yes",
    `[14] >> [19] vlm @ openssl req -x509 -newkey=rsa:4096 -keyout=env/local-authority.key.pem ${
      ""}-out=env/local-authority.crt -days=7300 -nodes -subj=/CN=localhost`),
cli("key    |value",
    "-------|-----",
    "success|true"),
`At this point the init completes for the first time. We still need to
select the authority-spindle, so we re-execute configure:`,
cli(command("vlm configure")),
`These two copy-template-files are redundant`,
cli("? Pick tools selection choices for the toolset '@valos/type-worker'",
    "◉ copy-template-files"),
cli("? Pick tools selection choices for the toolset '@valos/web-spindle'",
    "◉ copy-template-files"),
"Finally we get to select the authority-spindle toolset also.",
cli("? Pick toolsets selection choices for the workspace ",
    "◉ @valos/authority-spindle - Host a standalone authority using web-spindle route projectors",
    "◉ @valos/web-spindle       - Project http/s requests to valospace-fabric via a gateway plugin",
    `◯ @valos/toolset-revealer  - ${
        ""}Run 'vlm rouse-revealer' to serve local inspire sites with webpack-dev-server`,
    `◯ @valos/type-toolset      - ${
        ""}Make current workspace selectable as a toolset for other workspaces`),
`Let's use the default URI for the actual authority URI. While the port
and host should match the ones used by web-spindle, the hierarchy part
can be anything. `, em("taur"), ` is only inferred from the package name.`,
cli("? The authority valosp URI.",
    "  valosp://localhost:5443/taur/"),
cli("? Short description for the public authority config",
    "  Test authority"),
cli("? Pick tools selection choices for the toolset '@valos/authority-spindle'",
    "◉ copy-template-files"),
cli("key    |value",
    "-------|-----",
    "success|true "),
`The setup of the authority is now complete. Let's start the perspire
worker.`,
cli("vlm perspire"),
`If everything runs smoothly, we should have 15 routes on two prefixes:`,
cli(`[1] perspire informs: MapperService(MapperService$.1): listening @ ${
    ""}{ address: '127.0.0.1', family: 'IPv4', port: 5443 } prepared prefixes:`,
    "/: taur-worker@0.1.0 - openapi Example Title",
    "valosp://localhost:5443/taur/: taur-worker@0.1.0 - Test authority"),
    ],
  }
};
