export default function denodeify (fn) {
  return function () {
    var args = Array.prototype.slice.call(arguments)
    return new Promise(function (resolve, reject) {
      fn.apply(
        {},
        args.concat(function () {
          var args = Array.prototype.slice.call(arguments)
          var err = args[0]
          var values = args.slice(1)
          if (err) {
            reject(err)
          } else {
            resolve.apply({}, values)
          }
        })
      )
    })
  }
}
