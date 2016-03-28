var Hashish = require('./hashish')
var Seed = require('./seed')
var Module = require('module')

var original_module_require = Module.prototype.require

Module.prototype.require = function (library) {
  var explicitSkip = arguments.length >= 2 && arguments[1] === '__skip'
  if (explicitSkip) {
    return
  }
  var result = original_module_require.apply(this, arguments)
  if (typeof result === 'function' && (result.prototype instanceof Hashish)) {
    result.modulePath = library
  }
  return result
}

module.exports = function (sig, fn) {
  var typePathDict = sig.reduce((s, t) => (s[t.modulePath] = t.name, s), {})
  var requires = ["var Hashish = require('avtomati/src/hashish')"].concat(
    Object.keys(typePathDict).map((path) => `var ${typePathDict[path]} = require('${path}')`)
  ).join('\n')
  var src = requires + '\n\nseed = ' + fn.toString() + '\n//insertion point\n'
  return new Seed(function (git) {
    return browserify(src).then((script) => Seed.of(script).getHash(git))
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
