var Seed = require('./seed')

module.exports = function (sig, fn) {
  var typePathDict = sig.reduce((s, t) => (s[t.modulePath] = t.name, s), {})
  var requires = ["var Hashish = require('avtomati/src/hashish')"].concat(
    Object.keys(typePathDict).map((path) => `var ${typePathDict[path]} = require('${path}')`)
  ).join('\n')
  return new Seed(function (git) {
    return browserify(requires + '\n\nseed = ' + fn.toString() + '\n//insertion point\n')
      .then((script) => git.saveAs('blob', new Buffer(script, 'utf8')))
  })
}

var baseDir = require('path').dirname(module.parent.parent.filename)

function browserify (src) {
  var browserify = require('browserify')
  var stream = require('stream')
  return new Promise(function (resolve, reject) {
    var script = ''
    browserify({
      entries: new stream.Readable({ read: function () {
        this.push(src)
        this.push(null)
      }}),
      basedir: baseDir,
      builtins: false,
      browserField: false,
      commondir: false,
      insertGlobalVars: { Buffer: undefined }
    }).bundle().on('error', function (err) {
      reject(err)
    }).on('data', function (data) {
      script += data
    }).on('end', function () {
      resolve(script)
    })
  })
}
