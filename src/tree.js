'use strict'
var GitObject = require('./gitobject')
var modes = require('js-git/lib/modes')

const emptyTreeHash = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

class Tree extends GitObject {
  constructor (hash) {
    super(hash)
  }

  valueOf (git) {
    return this.getHash(git).then(function (hash) {
      return git.loadAs('tree', hash).then(function (entries) {
        var clone = {}
        for (var name of Object.keys(entries)) {
          var e = entries[name]
          var type = modes.toType(e.mode)
          var Ctor = require('./' + type)
          var obj = new Ctor(e.hash)
          if (obj.mode !== e.mode) {
            obj.mode = e.mode
          }
          clone[name] = obj
        }
        return clone
      })
    })
  }

  static of (value) {
    var keys = Object.keys(value)
    if (keys.length === 0) return new Tree(emptyTreeHash)
    return new Tree(
      git => Promise.all(
        keys.map(name => {
          var obj = value[name]
          return obj.getHash(git).then(hash => ({ name, mode: obj.mode, hash }))
        })
      ).then(entries => {
        entries = entries.reduce(
          (s, e) => (s[e.name] = { mode: e.mode, hash: e.hash }, s),
          {}
        )
        return git.saveAs('tree', entries)
      })
    )
  }

  get (Type, path, nullValue) {
    var pathsToGo = path.split('/')
    return this.bind(Type, function find (entries) {
      var name = pathsToGo.shift()
      var entry = entries[name]
      if (entry) {
        if (pathsToGo.length === 0) {
          return entry
        } else {
          if (entry instanceof Tree) {
            return entry.get(Type, pathsToGo.join('/'), nullValue)
          } /* if (entry instanceof Commit) { } */ else {
            throw new Error('not implemented, blob is bloking paths to go')
          }
        }
      } else {
        if (nullValue) {
          return nullValue
        }
        throw new Error('not found')
      }
    })
  }
}
Tree.prototype.mode = parseInt('040000', 8)
module.exports = Tree
