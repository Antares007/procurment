'use strict';
// enables JSX requires
require("babel/register")({ extensions: [".es6", ".es", ".jsx", ".js"] });

var argv = require('yargs').argv;
var path = require('path');
var mygit = require('./mygit.js');
var ხე = require('./ხე.js').ხე;
var Commit = require('./tesli/commit').Commit;

var git = mygit(argv.gitDir + '/.git');

var rootTreeSha = argv._;
var tesliPath = path.resolve(argv.tesli);

var fs = require('fs')

var memo
try {
  memo = JSON.parse(fs.readFileSync('memo.json'))
} catch (er) {
  memo = {}
}
git.getTreeFromCache = function(sha, seedId) {
  return memo[sha + '.' + seedId]
}
git.setTreeCache = function(sha, seedId, rezSha) {
  memo[sha + '.' + seedId] = rezSha
}

require(tesliPath)(new ხე(new Commit(argv._[0])))
  .commit.getSha(git)
  .then(function(sha) { console.log(sha); fs.writeFileSync('memo.json', JSON.stringify(memo, null, '  ')) })
  .catch(function(err){
    console.log(argv);
    process.nextTick(function(){
      throw err;
    });
  });

