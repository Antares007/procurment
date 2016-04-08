'use strict'
class Hashish {
  constructor (hashFn) {
    if (typeof hashFn !== 'function') throw new Error('argument error')
    this.getHash = hashFn.bind(this)
  }

  bind (Type, fn) {
    return new Type(
      (api) => this.valueOf(api).then(function (value) {
        var rez = fn(value)
        return rez.getHash(api)
      })
    )
  }

  valueOf (api) {
    return this.getHash(api).then((hash) => api.valueOf(hash))
  }

  castTo (Type) {
    return new Type((api) => this.getHash(api))
  }

  static of (buffer) {
    return new Hashish((api) => {
      return api.hash(buffer)
    })
  }
}
module.exports = Hashish
