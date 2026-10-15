// Express 4 ignores the promise an async handler returns, so a rejection never reaches
// next(err): the error handler doesn't run and the request hangs until the client gives
// up. This forwards rejections to next() for every route and middleware, which is what
// Express 5 does natively. Must be required before any router or route is created.
const Layer = require('express/lib/router/layer');

function forwardRejections(fn) {
  const wrapped = function (...args) {
    const ret = fn.apply(this, args);
    if (ret && typeof ret.catch === 'function') {
      const next = args[args.length - 1];
      ret.catch((err) => { if (typeof next === 'function') next(err); });
    }
    return ret;
  };
  // Express tells error handlers (err, req, res, next) apart by arity
  Object.defineProperty(wrapped, 'length', { value: fn.length });
  return wrapped;
}

Object.defineProperty(Layer.prototype, 'handle', {
  configurable: true,
  enumerable: true,
  get() { return this._forwardedHandle; },
  set(fn) { this._forwardedHandle = typeof fn === 'function' ? forwardRejections(fn) : fn; },
});
