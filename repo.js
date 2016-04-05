var fs = require('./mac-fs.js')

module.exports = function (gitDir) {
  var repo = {}
  repo.rootPath = gitDir || require('path').resolve(__dirname, '.git')
  require('js-git/mixins/fs-db')(repo, fs)
  require('js-git/mixins/read-combiner')(repo)

  var api = [
    'init',
    'saveAs',
    'loadAs',
    'readRef',
    'updateRef'
  ].reduce(
    (s, n) => (s[n] = toPromise(repo[n].bind(repo)), s),
    {}
  )
  api.runScript = memoize(runScript.bind({}, api))
  return {
    valueOf: function (obj) {
      return obj.valueOf(api)
    },
    get: function (Type, hash) {
      var o = new Type(() => Promise.resolve(hash))
      o.valueOf = o.valueOf.bind(o, api)
      return o
    },
    getHash: function (obj) {
      return obj.getHash(api)
    }
  }
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
