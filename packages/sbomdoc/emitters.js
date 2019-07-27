module.exports = {
  html: {
    "vdoc:Document": emitSBoMDocHTML,
    "sbomdoc:Document": emitSBoMDocHTML,
  },
};

function emitSBoMDocHTML (emission, node, document, emitNode /* , vdocld, extensions */) {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset='utf-8'>
    <title>${node["dc:title"]}</title>
  </head>
  <body>
    ${emitNode("", node["vdoc:content"], document)}
  </body>
</html>
`;
}
