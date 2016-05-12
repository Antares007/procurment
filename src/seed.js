'use strict'
var Tree = require('./tree')
var Blob = require('./blob')

class Seed extends Tree {
  call (Type) {
    return new Type((repo) => this.getHash(repo).then((hash) => repo.grow(hash)))
  }

  bind () {
    // var args = Array.prototype.slice.call(arguments)
    return super.bind(Seed, function (t) {
      return {
        bindedseed: Seed.of(t),
        'index.js': Blob.of(
          new Buffer(`
var seed = require('./bindedseed')
module.exports = function () {
  return seed.call(this, () => 'a')
}
`
          )
        )
      }
    })
  }

  valueOf (repo) {
    return super.valueOf(repo).then(function (t) {
      return t
    })
  }

  static of (def) {
    return Tree.of(def).castTo(Seed)
  }
}
module.exports = Seed
