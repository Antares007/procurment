'use strict'
const assert = require('assert').ok
const deasync = require('deasync')
const path = require('path')

const Package = require('gittypes/package')
const Blob = require('gittypes/blob')
const Module = require('./module.js')

module.exports = function (api, seedHash) {
  const valueOf = deasync(function (hashish, cb) {
    hashish
      .valueOf(api)
      .then((v) => cb(null, v))
      .catch((err) => cb(err))
  })

  Package.prototype.load = function (request = null, packageBasePath = '/', parentModule = null) {
    const self = this
    const modulesBasePath = path.join(packageBasePath, 'src')
    const pack = valueOf(this)
    const srcEntries = pack.srcEntries

    var rez
    if ((rez = loadCoreModule(request))) return rez

    request = request || path.normalize(pack.main)

    var reqModPath
    if (!reqModPath && srcEntries[request]) reqModPath = request
    if (!reqModPath && srcEntries[request + '.js']) reqModPath = request + '.js'
    if (!reqModPath && srcEntries[request + '/index.js']) reqModPath = request + '/index.js'

    if (reqModPath) {
      var hash = srcEntries[reqModPath]
      var id = self.hash + hash

      if (Module._cache[id]) return Module._cache[id].exports

      var blob = new Blob(() => Promise.resolve(hash))
      var absPath = path.join(modulesBasePath, reqModPath)
      var module = new Module(id, absPath, () => valueOf(blob), parentModule)
      module.require = function (request) {
        assert(request)
        assert(typeof request === 'string')
        if (request.startsWith('/')) throw new Error('absolute paths not supported')
        if (request.startsWith('./') || request.startsWith('../')) {
          var absPath = path.join(this.dirname, request)
          if (!absPath.startsWith(modulesBasePath)) throw new Error('request outside of package')
          var localPath = absPath.slice(modulesBasePath.length + 1)
          return self.load(localPath, packageBasePath, this)
        } else {
          return self.load(request, packageBasePath, this)
        }
      }.bind(module)

      Module._cache[id] = module

      var hadException = true
      try {
        module.load()
        hadException = false
      } finally {
        if (hadException) {
          delete Module._cache[id]
        }
      }

      return module.exports
    }

    var firstRequestSegment = request.split('/')[0]
    var dep = pack.dependencies[firstRequestSegment]
    if (dep) {
      return dep.load(
        request.slice(firstRequestSegment.length + 1),
        path.join(packageBasePath, 'dependencies', firstRequestSegment),
        parentModule
      )
    }
    throw new Error('module not found')
  }

  var p = new Package(() => Promise.resolve(seedHash))
  return p.load()
}

function loadCoreModule (x) {
  var mods = {
    'crypto': require('crypto'),
    'fs': {}
  }
  return mods[x]
}
