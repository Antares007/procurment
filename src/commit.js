'use strict'
var GitObject = require('./gitobject')
var Tree = require('./tree')

class Commit extends GitObject {
  constructor (hash) {
    super(hash)
  }

  valueOf (git) {
    return this.getHash(git).then(function (hash) {
      return git.loadAs('commit', hash).then(function (value) {
        return Object.assign({}, value, {
          tree: new Tree(value.tree),
          parents: value.parents
            ? value.parents.map(hash => new Commit(hash))
            : value.parents
        })
      })
    })
  }

  static of (def) {
    var objs = (def.parents || []).concat(def.tree)
    return new Commit(
      git => Promise.all(objs.map(o => o.getHash(git)))
        .then(hashes => {
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
