'use strict'
const Hashish = require('./hashish')
const Blob = require('./blob')
const emptyTreeHash = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
var codec = require('js-git/lib/object-codec')

class Tree extends Hashish {
  valueOf (api) {
    return super.valueOf(api).then(function (buffer) {
      var raw = codec.deframe(buffer)
      if (raw.type !== 'tree') throw new Error('not tree')
      var entries = codec.decoders[raw.type](raw.body)

      return Object.keys(entries).reduce(function (tree, name) {
        var e = entries[name]
        var mode = e.mode.toString(8)
        var copyData = (api_) => api === api_
          ? Promise.resolve(e.hash)
          : api.valueOf(e.hash).then(api_.hash)
        var obj = mode === '40000' || mode === '160000'
          ? new Tree(copyData)
          : new Blob(copyData)
        obj.mode = e.mode
        tree[name] = obj
        return tree
      }, {})
    })
  }

  static of (value) {
    var keys = Object.keys(value)
    if (keys.length === 0) return new Tree(() => Promise.resolve(emptyTreeHash))
    return new Tree(
      (api) => Promise.all(
        keys.map((name) => {
          var obj = value[name]
          return obj.getHash(api).then((hash) => ({ name, mode: obj.mode, hash }))
        })
      ).then((entries) => {
        var tree = entries.reduce(function (s, e) {
          if (e.hash === emptyTreeHash) return s
          var mode = e.mode || parseInt(e instanceof Tree ? '40000' : '100644', 8)
          s[e.name] = { mode, hash: e.hash }
          return s
        }, {})
        var buffer = codec.frame({
          type: 'tree',
          body: codec.encoders['tree'](tree)
        })
        return Hashish.of(buffer).getHash(api)
      })
    )
  }
}
module.exports = Tree
