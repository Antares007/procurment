'use strict'
class Hashish {
  static get (Type, hash) {
    return new Type((git) => Promise.resolve(hash))
  }

  constructor (hashFn) {
    if (typeof hashFn !== 'function') throw new Error('argument error')
    this.hashFn = hashFn
  }

  getHash (git) {
    return this.hashFn(git)
  }

  bind (Type, fn) {
    return new Type(
      (ipfs) => valueOf.call(this, ipfs).then(function (value) {
        return fn(value).getHash(ipfs)
      })
    )
  }
}

module.exports = Hashish
// var valuesMap = new WeakMap()
function valueOf (ipfs) {
  // if (valuesMap.has(this)) return valuesMap.get(this)
  var valuePromise = this.valueOf(ipfs)
  // valuesMap.set(this, valuePromise)
  return valuePromise
}

// var hashMap = new WeakMap()
// var old_getHash = Hashish.prototype.getHash
// Hashish.prototype.getHash = function (ipfs) {
//   if (hashMap.has(this)) return hashMap.get(this)
//     var hashPromise = old_getHash.call(this, ipfs)
//   hashMap.set(this, hashPromise)
//   return hashPromise
// }
