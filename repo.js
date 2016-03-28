module.exports = function (gitDir) {
  var repo = {}
  repo.rootPath = gitDir || require('path').resolve(__dirname, '.git')
  require('js-git/mixins/fs-db')(repo, require('./mac-fs.js'))
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

function runScript (api, script) {
  var vm = require('vm')
  var sendbox = vm.createContext({console, Promise, Buffer, seed: {}})
  vm.runInContext(script, sendbox)
  var seed = sendbox.seed()
  return seed.getHash(api)
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
