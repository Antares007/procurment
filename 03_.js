var split = require('split');
var equal = require('deep-equal');
var logProgress = require('./logprogress.js');
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var parsers = require('./parser');


module.exports = function(oldRoot, newRoot, oldTree) {

  oldRoot
    .diff(newRoot)
    .filter(x => x.path.indexOf('s/140/444') > 0)
    .map(async function(patch){
      return {
        s: patch.status,
        p: patch.path,
        n: parseTender(await patch.newContent()),
        o: patch.status === 'M' ? parseTender(await patch.oldContent()) : undefined
      };
    })
    .filter(x => !equal(x.n, x.o))


    .valueOf()
    .pipe(logProgress(100))
    .on('data', function(data){

    });

  return;

  function parseTender(content){
    var pages = content.toString().split(String.fromCharCode(0));
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
