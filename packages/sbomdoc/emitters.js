module.exports = {
  html: {
    "vdoc:Document": emitSBoMDocHTML,
    "sbomdoc:Document": emitSBoMDocHTML,
  },
};

function emitSBoMDocHTML (node, emission, stack) {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset='utf-8'>
    <title>${node["dc:title"]}</title>
  </head>
  <body>
    ${stack.emitNode(node["vdoc:content"], "")}
  </body>
</html>
`;
}
