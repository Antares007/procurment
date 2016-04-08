'use strict'
var Hashish = require('./hashish')
var Tree = require('./tree')
var codec = require('js-git/lib/object-codec')

class Commit extends Hashish {
  valueOf (api) {
    return super.valueOf(api).then(function (buffer) {
      var raw = codec.deframe(buffer)
      if (raw.type !== 'commit') throw new Error('not tree')
      var value = codec.decoders[raw.type](raw.body)
      var commit = Object.assign({}, value, {
        tree: new Tree((api_) => api.valueOf(value.tree).then(api_.hash)),
        parents: value.parents.map((hash) => new Commit((api_) => api.valueOf(hash).then(api_.hash)))
      })
      if (commit.parents.length === 0) {
        delete commit.parents
      }
      return commit
    })
  }

  static of (def) {
    var objs = (def.parents || []).concat(def.tree)
    return new Commit(
      (api) => Promise.all(objs.map((o) => o.getHash(api))).then((hashes) => {
        var treeHash = hashes.pop()
        var parentHases = hashes
        var commit = Object.assign({}, def, { tree: treeHash, parents: parentHases })
        var buffer = codec.frame({
          type: 'commit',
          body: codec.encoders['commit'](commit)
        })
        return Hashish.of(buffer).getHash(api)
      })
    )
  }
}
module.exports = Commit
