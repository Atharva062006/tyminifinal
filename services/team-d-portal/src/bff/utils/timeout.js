/**
 * Timeout wrapper for async operations (HTTP requests, etc.)
 */
class TimeoutError extends Error {
  constructor(message = 'Operation timed out', timeoutMs = 5000) {
    super(message);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
    this.code = 'TIMEOUT';
  }
}

/**
 * Executes a promise with a timeout limit.
 * @param {Promise} promise 
 * @param {number} timeoutMs 
 * @param {string} [operationName='Operation']
 * @returns {Promise<any>}
 */
async function withTimeout(promise, timeoutMs = 5000, operationName = 'Downstream request') {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new TimeoutError(`${operationName} exceeded timeout of ${timeoutMs}ms`, timeoutMs));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timer);
    return result;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

module.exports = { withTimeout, TimeoutError };
