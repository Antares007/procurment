'use strict'
var Tree = require('./tree')

class Seed extends Tree {
  call (Type) {
    return new Type((api) => this.getHash(api).then((hash) => api.grow(hash)))
  }

  valueOf (api) {
    return super.valueOf(api).then(function (t) {
      return t
    })
  }

  static of (def) {
    return Tree.of(def).castTo(Seed)
  }
}
module.exports = Seed
