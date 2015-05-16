var debug = require('debug')('tesliRunner');
var transform = require('./transform.js');
var mygit = require('./mygit.js');
var denodeify = require('./denodeify.js');

var mygit = mygit('/data/procurment-data2/.git');
var git = [
  'revParse',
  'lsTree',
  'mktree',
  'hashObject'
].reduce((s, x) => (s[x] = denodeify(mygit[x]), s), {});

var catFileBatch = mygit.catFileBatch();
git.cat = denodeify(catFileBatch.cat);

git.diffTree = mygit.diffTree;

git.openIndex = function(path) {
  var index = mygit.openIndex(path);
  return {
    readTree: denodeify(index.readTree),
    writeTree: denodeify(index.writeTree),
    createUpdateIndexInfoStream: index.createUpdateIndexInfoStream
  }
};

var emptyTreeSha = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

git.mkDeepTree = async function(entries){
  var defer = Promise.defer();
  var index = git.openIndex('indexDeepTree');
  await index.readTree(emptyTreeSha);
  var indexInfoWriter = index.createUpdateIndexInfoStream();
  indexInfoWriter
    .once('error', err => defer.reject(err))
    .once('child.exit', () => defer.resolve())
    .write(entries.map(e => `${e.mode} ${e.sha}\t${e.path}`).join('\n'));
  indexInfoWriter.end();
  await defer.promise;
  return await index.writeTree();
}

var { Tree } = require('./tesli.js');
var tesli = require('./03_.js');

var oldRoot = new Tree();
var newRoot = new Tree('38f5e5fa6f33cac790c29650bead4f88905b2abb');

var oldTree = new Tree();
var newTree = oldTree.cd(function(oldTreeDir){
  tesli.call(oldTreeDir, oldRoot, newRoot);
});


newTree.getSha(git).then(function(sha){
  console.log(sha);
  catFileBatch.end();
}).catch(function(err){
  console.log('err', err);
  console.log('err', err.stack);
  catFileBatch.end();
});
