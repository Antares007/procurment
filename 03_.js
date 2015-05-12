var parsers = require('./parser');

module.exports = function(oldRoot, newRoot, oldTree) {

  var tendersPatch = oldRoot.get('tenders', new Tree()).diff(newRoot.get('tenders'))

  var oldParsedTendersTree = oldTree.get('parsedTenders', new Tree());

  var newParsedTendersTree = tendersPatch.map(parseTender).apply(oldParsedTendersTree);

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
