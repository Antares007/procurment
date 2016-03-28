var fs = require('./mac-fs.js')
var crypto = require('crypto')

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
  api.runScript = runScript.bind({}, api)
  return api
}

var readFile = toPromise(fs.readFile)
var writeFile = toPromise(fs.writeFile)
var path = require('path')
function runScript (api, script) {
  var sha = hash(script)
  sha = sha.slice(0, 2) + '/' + sha.slice(2)
  var fileName = path.resolve(__dirname, '.cache', sha)
  return readFile(fileName).then(function (buff) {
    if (buff) return Promise.resolve(buff.toString())
    var vm = require('vm')
    var sendbox = vm.createContext({console, Promise, Buffer, seed: {}})
    vm.runInContext(script, sendbox)
    var seed = sendbox.seed()
    return seed.getHash(api).then(function (hash) {
      return writeFile(fileName, new Buffer(hash)).then(function () {
        return hash
      })
    })
  })
}

function hash (value) {
  var shasum = crypto.createHash('sha1')
  shasum.update(value.toString())
  return shasum.digest('hex')
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
