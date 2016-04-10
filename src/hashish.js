'use strict'
class Hashish {
  constructor (hashFn) {
    if (typeof hashFn !== 'function') throw new Error('argument error')
    this.getHash = (api) => hashFn(api).then((hash) => (this.hash = hash, hash))
  }

  bind (Type, fn) {
    return new Type((api) => this.valueOf(api).then(function (value) {
      var rez = fn(value)
      if (rez instanceof Hashish) {
        if (rez.constructor === Type) {
          return rez.getHash(api)
        } else {
          throw new Error(`cant bind ${rez.constructor.name} to ${Type.name}`)
        }
      } else {
        return Type.of(rez).getHash(api)
      }
    }))
  }

  valueOf (api) {
    return this.getHash(api).then((hash) => api.valueOf(hash))
  }

  castTo (Type) {
    return new Type((api) => this.getHash(api))
  }

  static of (buffer) {
    return new Hashish((api) => api.hash(buffer))
  }
}
module.exports = Hashish
