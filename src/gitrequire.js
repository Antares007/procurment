'use strict'
const assert = require('assert').ok
const path = require('path')

const Package = require('gittypes/package')
const Seed = require('gittypes/seed')
const Tree = require('gittypes/tree')
const Blob = require('gittypes/blob')
const Module = require('./module.js')
const debug = require('debug')('gitrequire')

const internalNodeModules = {
  'crypto': require('crypto'),
  'fs': {}
}
const internalModules = [
  'hashish', 'blob', 'tree', 'commit',
  'seed', 'package', 'fun', 'json'
].reduce(function (s, t) {
  var name = 'gittypes/' + t
  s[name] = require(name)
  return s
}, internalNodeModules)

module.exports = function (valueOfSync, grow) {
  Package.prototype.call = function (Type, ...args) {
    args = args.reduce(function (s, a, i) {
      s[('000' + i.toString()).slice(-3)] = a
      return s
    }, {})
    var argsTree = Tree.of(args)
    return new Type(() => grow(Seed.of({ args: argsTree, fn: this })))
    // return Seed.of({ args: argsTree, fn: this }).call(Type)
  }

  Package.prototype.load = function (request = null, packageBasePath = '/', parentModule = null) {
    const pack = valueOfSync(this)
    this.name = pack.name
    const self = this
    const modulesBasePath = path.join(packageBasePath, 'src')
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
      debug(pack.name, request, id)

      var blob = new Blob(() => Promise.resolve(hash))
      var absPath = path.join(modulesBasePath, reqModPath)
      var module = new Module(id, absPath, parentModule)
      var requireFn = function (request) {
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
      }
      module.require = requireFn.bind(module)
      module.require.asPackage = function (request) {
        if (request === '.') return self
        var rez = pack.dependencies[request]
        if (!rez) throw new Error(`cant resolvePackage '${request}'`)
        return rez
      }

      Module._cache[id] = module

      var hadException = true
      try {
        var script = valueOfSync(blob).toString()
        module.load(script)
        hadException = false
      } finally {
        if (hadException) {
          console.log('eeeeeeeeeeeeeee')
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
    throw new Error(`module [${request}] not found`)
  }
}

function loadCoreModule (x) {
  return internalModules[x]
}
