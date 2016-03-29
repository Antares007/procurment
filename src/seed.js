'use strict'
var Hashish = require('./hashish')

module.exports = class Seed extends Hashish {
  valueOf (git) {
    return this.getHash(git).then(function (hash) {
      return git.loadAs('blob', hash).then((buffer) => buffer.toString('utf8'))
    })
  }

  static of (script) {
    return new Seed((git) => git.saveAs('blob', new Buffer(script, 'utf8')))
  }

  bind () {
    var args = Array.prototype.slice.call(arguments)
    if (args.length === 0) return this
    return new Seed((git) => {
      var mapper = (a) => a instanceof Hashish
        ? a.getHash(git).then((hash) => `Hashish.get(${a.constructor.name}, '${hash}')`)
        : typeof a === 'function'
          ? a.toString()
          : JSON.stringify(a)
      var promisedValues = args.map(mapper)
      return Promise.all(promisedValues.concat(this.valueOf(git))).then(function (values) {
        var script = values.pop()
        var args = values.join(', ')
        var insertPos = script.lastIndexOf('//insertion point')
        var bindStr = `seed = seed.bind({}, ${args})`
        script = script.slice(0, insertPos) + bindStr + '\n' + script.slice(insertPos)
        return Seed.of(script).getHash(git)
      })
    })
  }

  call () {
    var args = Array.prototype.slice.call(arguments)
    var RetType = args[0]
    var seedArgs = args.slice(1)
    return new RetType((git) => this.bind.apply(this, seedArgs).valueOf(git).then(function (script) {
      var rez = git.runScript(script)
      return rez
    }))
  }
}

