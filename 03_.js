var parsers = require('./parser');

module.exports = function(oldRoot, newRoot, oldTree) {

  var oldTendersRoot = !oldRoot.isEmpty ? oldRoot.cd('tenders') : oldRoot;
  var newTendersRoot = newRoot.cd('tenders');

  var tendersPatch = oldTendersRoot.diff(newTendersRoot);

  var oldParsedTendersTree = !oldTree.isEmpty ? oldTree.cd('parsedTenders') : oldTree;

  var newParsedTendersTree = tendersPatch
    .filter(p => p.path.indexOf('140/') === 0)
    .map(function(key, buffer){
      var tender = parseTender(buffer);
      var id = parseInt(key.split(/\/|\./).splice(1, 3).join(''), 10);
      this.emit(id.toString(), tender);
    })
    .apply(oldParsedTendersTree);

  var newTree = oldTree.set('parsedTenders', newParsedTendersTree);

  return newTree;

  function parseTender(buffer){
    var pages = buffer.toString('utf8').split(String.fromCharCode(0));
    try {
      return {
        app_main: parsers.app_main(pages[0]),
        app_docs: parsers.app_docs(pages[1]),
        app_bids: parsers.app_bids(pages[2]),
        app_result: parsers.app_result(pages[3]),
        agency_docs: parsers.agency_docs(pages[4])
      };
    } catch(e) {
      return {
        err: e.toString()
      };
    }
  }
};
