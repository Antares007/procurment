import transform from './transform.js'

export class AStream {

  constructor (readableStreamFactory) {
    this.readableStreamFactory = readableStreamFactory
  }

  valueOf () {
    return this.readableStreamFactory()
  }

  toArray (writable) {
    var array = []
    return new Promise((resolve, reject) => this.valueOf()
      .on('data', data => array.push(data))
      .on('error', err => reject(err))
      .on('end', () => resolve(array))
    )
  }

  writeTo (writable) {
    return new Promise((resolve, reject) => this.valueOf()
      .on('error', err => reject(err))
      .pipe(writable)
      .on('error', err => reject(err))
      .on('child.exit', () => resolve()))
      // TODO: after finish index is still locked. wait process to exit
  }

  pipe (stream) {
    return new AStream(() => pipe(
      this.readableStreamFactory(),
      stream
    ))
  }

  transform (fn) {
    return new AStream(() => pipe(
      this.readableStreamFactory(),
      transform(function (x, next) {
        var ds = this
        var maybePromise = fn.call(
          this,
          x,
          () => { if (!(maybePromise instanceof Promise)) next() }
        )
        if (maybePromise instanceof Promise) {
          maybePromise
            .then(next)
            .catch(function (err) {
              process.nextTick(function () {
                ds.emit('error', err)
              })
            })
        }
      })
    ))
  }

  map (fn) {
    return new AStream(() => pipe(
      this.readableStreamFactory(),
      transform(function (x, next) {
        var ds = this
        var value = fn(x)
        if (value instanceof Promise) {
          value.then(function (rez) {
            ds.push(rez)
            next()
          }).catch(function (err) {
            process.nextTick(function () {
              ds.emit('error', err)
            })
          })
        } else {
          this.push(value)
          next()
        }
      })
    ))
  }

  filter (fn) {
    return new AStream(() => pipe(
      this.readableStreamFactory(),
      transform(function (x, next) {
        if (fn(x)) {
          this.push(x)
        }
        next()
      })
    ))
  }

  scan (fn, state) {
    return new AStream(() => pipe(
      this.readableStreamFactory(),
      transform(function (x, next) {
        state = fn(state, x)
        this.push(state)
        next()
      })
    ))
  }

  reduce (fn, state) {
    return new AStream(() => pipe(
      this.readableStreamFactory(),
      transform(function (x, next) {
        state = fn(state, x)
        next()
      }, function (done) {
        this.push(state)
        done()
      })
    ))
  }
}

function pipe (u, d) {
  u.on('error', function (err) {
    d.emit('error', err)
  })
  u.pipe(d)
  return d
}
