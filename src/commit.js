'use strict'
var GitObject = require('./gitobject')
var Tree = require('./tree')
var run = require('gen-run')

class Commit extends GitObject {
  constructor (hash) {
    super(hash)
  }

  valueOf (git, cb) {
    if (!cb) return this.valueOf.bind(this, git)
    var self = this
    run(function * () {
      var hash = yield self.getHash(git)
      var value = yield git.loadAs('commit', hash)
      return Object.assign({}, value, {
        tree: new Tree(value.tree),
        parents: value.parents
          ? value.parents.map(hash => new Commit(hash))
          : value.parents
      })
    }, cb)
  }

  static of (def) {
    return new Commit((git, cb) => run(function * () {
      var commit = Object.assign({}, def, {
        tree: yield def.tree.getHash(git),
        parents: def.parents && def.parents.length > 0
          ? yield def.parents.map(x => x.getHash(git))
          : []
      })
      var hash = yield git.saveAs('commit', commit)
      return hash
    }, cb))
  }
}
Commit.prototype.mode = parseInt('160000', 8)
module.exports = Commit
