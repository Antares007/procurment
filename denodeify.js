module.exports = function denodeify(fn) {
  return function (...args) {
    return new Promise(function (resolve, reject) {
      fn(...args, function(err, value) {
        if(err) {
          reject(err);
        } else {
          resolve(value);
        }
      });
    });
  };
}
