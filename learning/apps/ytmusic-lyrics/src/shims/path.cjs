// kuromoji joins dictionary URLs with Node's path.join, which collapses the "//" in
// chrome-extension:// URLs. This keeps the URL intact.
module.exports = {
  join(base, file) {
    return base.replace(/\/?$/, "/") + file;
  },
};
