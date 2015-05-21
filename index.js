var rootCommit;
var thisHeadCommit;
var mapTenders;
var khe;

// var cp0 = mapTenders()
// var cp1 = mapTenders()
// var cp2 = mapTenders()
// var cp3 = mapTenders()
// var cp4 = mapTenders()


// thisTreeComit.merge(cp0, cp1, cp2, cp3, cp4);

makeTree(null, '38f5e5fa6f33cac790c29650bead4f88905b2abb', null, function(err, sha){
  if(err) console.log(err.stack);
  console.log(sha);
})

function makeTree(oldRootSha, newRootSha, oldTreeSha, cb){
  var debug = require('debug')('tesliRunner');
  var mygit = require('./mygit.js');
  var git = mygit('/data/procurment-data2/.git');

  var { Tree } = require('./tesli.js');
  var tesli = require('./03_.js');

  var oldRoot = new Tree();
  var newRoot = new Tree('38f5e5fa6f33cac790c29650bead4f88905b2abb');

  var oldTree = new Tree();
  var newTree = oldTree.cd(function(oldTreeDir){
    tesli.call(oldTreeDir, oldRoot, newRoot);
  });

  var batchCat = git.catFileBatch();
  git.cat = batchCat.cat;
  newTree.getSha(git).then(function(sha){
    batchCat.end();
    cb(null, sha);
  }).catch(function(err){
    console.log('aaa');
    batchCat.end();
    console.log(err);
    cb(err);
  });
}
