module.exports = function denodeify(fn) {
  return function (...args) {
    return new Promise(function (resolve, reject) {
      fn(...args, function(err, ...values) {
        if(err) {
          reject(err);
        } else {
          if(values.length > 1){
            resolve(values);
          } else {
            resolve(...values)
          }
        }
      });
    });
  };
}
