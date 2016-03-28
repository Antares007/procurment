var Module = require('module')
var original_module_require = Module.prototype.require
Module.prototype.require = function (library) {
  var explicitSkip = arguments.length >= 2 && arguments[1] === '__skip'
  if (explicitSkip) {
    return
  }
  var result = original_module_require.apply(this, arguments)
  result.modulePath = library
  return result
}
module.exports = {
  Hashish: require('./hashish'),
  Blob: require('./blob'),
  Tree: require('./tree'),
  Commit: require('./commit'),
  git: require('../repo'),
  createSeed: require('../src/createseed'),
  get: (Type, hash) => new Type((git) => Promise.resolve(hash))
}

