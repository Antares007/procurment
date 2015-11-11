var fs = require('fs')
var mkdirp = require('mkdirp')

module.exports = {
  rename: fs.rename,
  // - readFile(path) => binary
  //   Must also call callback() with no arguments if the file does not exist.
  readFile: (path, cb) => fs.readFile(path, function (err, buffer) {
    if (err) return err.code === 'ENOENT' ? cb() : cb(err)
    cb(null, buffer)
  }),
  // - readChunk(path, start, end) => binary
  //   Must also call callback() with no arguments if the file does not exist.
  readChunk: (path, start, end, cb) => fs.open(path, 'r', function (err, fd) {
    if (err) return err.code === 'ENOENT' ? cb() : cb(err)
    fs.fstat(fd, function (err, stats) {
      if (err) return cb(err)
      end = end < 0 ? stats.size + end : end
      var length = end - start
      var buffer = new Buffer(length)
      fs.read(fd, buffer, 0, length, start, function (err, bytesRead, buffer) {
        if (err) return cb(err)
        if (bytesRead !== length) return cb(new Error('fs.readChunk bytesRead !== length'))
        cb(null, buffer)
        fs.close(fd)
      })
    })
  }),
  // - writeFile(path, binary) =>
  //   Must also make every directory up to parent of path.
  writeFile: (path, binary, cb) => mkdirp(
    path.split('/').slice(0, -1).join('/'),
    function (err) {
      if (err) return cb(err)
      fs.writeFile(path, binary, { flag: 'wx' }, function (err) {
        if (err) return cb(err)
        cb()
      })
    }
  ),
  // - readDir(path) => array<paths>
  //   Must also call callback() with no arguments if the file does not exist.
  readDir: (path, cb) => fs.readdir(path, function (err, files) {
    if (err) return err.code === 'ENOENT' ? cb() : cb(err)
    cb(null, files)
  })
}
