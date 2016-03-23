var repo = require('../repo')()

module.exports = function (tests) {
  var rez = tests.map(function (test) {
    try {
      var rez = test()
      var actual = rez.actual
      var expected = rez.expected
      return actual.getHash(repo).then(
        (hash1) => expected.getHash(repo).then(
          (hash2) => hash1 === hash2
        )
      )
    } catch (ex) {
      return Promise.resolve('error ' + ex.message)
    }
  })
  Promise.all(rez).then((rezults) => console.log(rezults))
    .catch(console.log.bind(console))
}
