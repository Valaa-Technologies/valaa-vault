module.exports = { "...": { heading:
  "Valma (or 'vlm') is a command script dispatcher",
},
  0: [
    `Any npm package can export new valma commands by exporting .js
    command scripts via its package.json .bin stanza. When such a
    package is added as a devDependency for a workspace valma will
    then be able to locate and invoke those commands from anywhere
    inside the workspace.`,
    "",
    `Valma commands are hierarchical and can contain '/' in their
    names. Valma invokations can use glob matching to make full use of
    these hierarchical path parts (notably using the distinction
      between '*' and '**').`,
    "",
    `A command for which any path part begins with '.' is hidden, all
    other commands are listed. Listed scripts can be seen with 'vlm',
    'vlm --help' or 'vlm -d' and they are typically intended to be
    called by the user via the command line. Hidden scripts don't
    appear in listings and are intended to be called by other valma
    scripts. They can nevertheless be called directly and can be listed
    with option -a.`,
    "",
    `The export name in the npm package.json .bin stanza must be the
    command name prefixed with '_vlm_' (or '_vlm__' if a hidden
    command begins with a '.'). Additionally export name must have all
    '/' replaced with '_' due to npm limitations. Valma will always
    treat '_' and '/' characters to be equal although '/' is
    recommended anywhere possible.`
  ]
};
