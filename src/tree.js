'use strict'
var Hashish = require('./hashish')
const emptyTreeHash = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

const blob = parseInt('100644', 8)
const tree = parseInt('40000', 8)
const commit = parseInt('160000', 8)

// parseInt( '40000', 8)  tree:
// parseInt('100644', 8)  blob:
// parseInt('100644', 8)  file:
// parseInt('100755', 8)  exec:
// parseInt('120000', 8)  sym:
// parseInt('160000', 8)  commit:

function toType (mode) {
  if ((mode & blob) === blob) return require('./blob')
  if (mode === tree) return require('./tree')
  if (mode === commit) return require('./commit')
  throw new Error('mode not supported')
}

class Tree extends Hashish {
  valueOf (git) {
    return this.getHash(git).then(function (hash) {
      if (hash === emptyTreeHash) return {}
      return git.loadAs('tree', hash).then(function (entries) {
        var clone = {}
        for (var name of Object.keys(entries)) {
          let e = entries[name]
          let Ctor = toType(e.mode)
          let obj = new Ctor(() => Promise.resolve(e.hash))
          obj.mode = e.mode
          clone[name] = obj
        }
        return clone
      })
    })
  }

  static of (value) {
    var keys = Object.keys(value)
    if (keys.length === 0) return Hashish.get(Tree, emptyTreeHash)
    return new Tree(
      (git) => Promise.all(
        keys.map((name) => {
          var obj = value[name]
          return obj.getHash(git).then((hash) => ({ name, mode: obj.mode, hash }))
        })
      ).then((entries) => git.saveAs('tree', entries.reduce(function (s, e) {
        if (e.hash === emptyTreeHash) return s
        s[e.name] = { mode: e.mode, hash: e.hash }
        return s
      }, {}))
      )
    )
  }
}
Tree.prototype.mode = parseInt('040000', 8)
Tree.empty = Hashish.get(Tree, emptyTreeHash)
module.exports = Tree
