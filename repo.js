module.exports = function (gitDir) {
  var repo = {}
  repo.rootPath = gitDir || require('path').resolve(__dirname, '.git')
  require('js-git/mixins/fs-db')(repo, require('./mac-fs.js'))
  require('js-git/mixins/read-combiner')(repo)

  return [
    'init',
    'saveAs',
    'loadAs',
    'readRef',
    'updateRef'
  ].reduce(
    (s, n) => (s[n] = toPromise(repo[n].bind(repo)), s),
    {}
  )
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
