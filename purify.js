var crypto = require('crypto')

function hash (value) {
  var shasum = crypto.createHash('sha1')
  shasum.update(value.toString())
  return shasum.digest('hex')
}

function deserializefn (value) {
  if (value && typeof value === 'string' && value.substr(0, 8) === 'function') {
    var startBody = value.indexOf('{') + 1
    var endBody = value.lastIndexOf('}')
    var startArgs = value.indexOf('(') + 1
    var endArgs = value.indexOf(')')
    var debug = require('debug')('khe') //eslint-disable-line
    var body = value.substring(startBody, endBody)
    var args = value.substring(startArgs, endArgs)
    return new Function(args, body) // eslint-disable-line
  }
}

function purify_0 (fn) {
  var fnStr = fn.toString()
  var pureFn = deserializefn(fnStr)
  pureFn.id = hash(fnStr)
  return fn.length === 0 ? pureFn() : pureFn
}

var excelConverter = {
  import: b => require('./xlsx-importer')(b),
  export: ws => require('./xlsx-exporter')(ws)
}
var jsonConverter = {
  import: x => JSON.parse(x.toString()),
  export: x => new Buffer(JSON.stringify(x))
}
var converters = {
  'xlsx': excelConverter,
  'xls': excelConverter,
  'json': jsonConverter,
  'default': jsonConverter
}

function getConverter (path) {
  var key = Object.keys(converters)
    .filter(ext => path.lastIndexOf('.' + ext) === path.length - ext.length - 1)[0] || 'default'
  return converters[key]
}

export default function purify (fn) {
  fn = purify_0(fn)
  var fn2 = function (...args) {
    args = args.map(a => a instanceof Buffer ? getConverter(args[args.length - 1]).import(a) : a)
    return fn.apply({ emit: (path, value) => this.emit(path, getConverter(path).export(value)) }, args)
  }
  fn2.id = fn.id
  return fn2
}

