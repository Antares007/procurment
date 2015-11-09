var genrun = require('gen-run')
module.exports = function run (fn) {
  return new Promise(function (resolve, reject) {
    genrun(fn, function (err, value) {
      if (err) {
        reject(err)
      } else {
        resolve(value)
      }
    })
  })
}
