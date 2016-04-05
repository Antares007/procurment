'use strict'
var Hashish = require('./hashish')
var Tree = require('./tree')

class Commit extends Hashish {
  valueOf (git) {
    return this.getHash(git).then(function (hash) {
      return git.loadAs('commit', hash).then(function (value) {
        var commit = Object.assign({}, value, {
          tree: Hashish.get(Tree, value.tree),
          parents: value.parents.map((hash) => Hashish.get(Commit, hash))
        })
        if (commit.parents.length === 0) {
          delete commit.parents
        }
        return commit
      })
    })
  }

  static of (def) {
    var objs = (def.parents || []).concat(def.tree)
    return new Commit(
      (git) => Promise.all(objs.map((o) => o.getHash(git)))
        .then((hashes) => {
          var treeHash = hashes.pop()
          var parentHases = hashes
          var commit = Object.assign({}, def, {
            tree: treeHash,
            parents: parentHases
          })
          return git.saveAs('commit', commit)
        })
    )
  }
}
Commit.prototype.mode = parseInt('160000', 8)
module.exports = Commit
