'use strict'
var mygit = require('./engine/mygit.js')
var Commit = require('./commit').Commit

module.exports = function (rootSha, gitdir, seed, cb) {
  var git = mygit(gitdir)
  var batchCat = git.catFileBatch()
  var rootCommit = new Commit(rootSha)
  git.cat = batchCat.cat
  seed(rootCommit).getSha(git)
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

