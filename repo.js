var fs = require('./mac-fs.js')
var Tree = require('./src/tree')
var sha1 = require('git-sha1')

module.exports = function (gitDir) {
  var repo = {}
  repo.rootPath = gitDir || require('path').resolve(__dirname, '.git')
  require('js-git/mixins/fs-db')(repo, fs)
  require('js-git/mixins/read-combiner')(repo)
  var api = {
    valueOf: function (hash) {
      return new Promise(function (resolve, reject) {
        repo.loadRaw(hash, function (err, buffer) {
          if (!buffer) {
            reject(new Error('dont exists'))
          } else if (err) {
            reject(err)
          } else {
            resolve(buffer)
          }
        })
      })
    },
    hash: function (buffer) {
      return new Promise(function (resolve, reject) {
        var hash = sha1(buffer)
        repo.saveRaw(hash, buffer, function (err) {
          if (err) { reject(err) } else { resolve(hash) }
        })
      })
    }
  }
  return api
}

/* eslint-disable */
function createModule (imports, fn) {
  var fnstr = fn.toString()
  var body = fnstr.substring(fnstr.indexOf('{') + 1, fnstr.lastIndexOf('}'))
  var importNames = fnstr.substring(fnstr.indexOf('(') + 1, fnstr.indexOf(')'))
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((name, i) => imports[i].getHash(api).then((hash) => ({ name, hash })))
  Promise.all(importNames).then(function (importNames) {
    console.log(importNames)
  })
  return Tree.of({})
}
function runScript (api, seedHash) {
  return api.loadAs('blob', seedHash).then(function (buff) {
    var script = buff.toString('utf8')
    var vm = require('vm')
    var sendbox = vm.createContext({console, Promise, Buffer, seed: {}})
    vm.runInContext(script, sendbox)
    var rez = sendbox.seed()
    return rez.getHash(api)
  })
}

function memoize (fn) {
  var readFile = toPromise(fs.readFile)
  var writeFile = toPromise(fs.writeFile)
  var path = require('path')
  return function (seedHash) {
    var cacheFileName = path.resolve(__dirname, '.cache', seedHash.slice(0, 2) + '/' + seedHash.slice(2))
    return readFile(cacheFileName).then(function (buff) {
      if (buff) return Promise.resolve(buff.toString())
      var rez = fn(seedHash)
      return rez.then(function (hash) {
        return writeFile(cacheFileName, new Buffer(hash)).then(function () {
          return hash
        })
      })
    })
  }
}
function toPromise (fn) {
  return function () {
    var args = Array.prototype.slice.call(arguments)
    return new Promise((resolve, reject) => {
      fn.apply(this, args.concat(function (err, value) {
        if (err) {
          reject(err)
        } else {
          resolve(value)
        }
      }))
    })
  }
}
