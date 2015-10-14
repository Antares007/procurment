'use strict'
var mygit = require('./mygit.js')
var Commit = require('./tesli/gitobject').Commit

module.exports = function (rootSha, gitdir, seed, cb) {
  var git = mygit(gitdir)
  var batchCat = git.catFileBatch()
  var rootCommit = new Commit(rootSha)
  git.cat = batchCat.cat
  var treeCommit = seed(rootCommit)
  treeCommit.getSha(git)
    .then(function (sha) {
      batchCat.end()
      cb(null, sha)
    })
    .catch(function (err) {
      process.nextTick(function () {
        cb(err)
      })
    })
}

