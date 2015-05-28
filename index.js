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

require(tesliPath)(new ხე(new Commit(argv._[0])))
  .commit.getSha(git)
  .then(function(sha) { console.log(sha); })
  .catch(function(err){
    console.log(argv);
    process.nextTick(function(){
      throw err;
    });
  });

