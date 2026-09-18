/**
 * Safe retry utility with exponential backoff for idempotent operations.
 */

/**
 * Retries an asynchronous function up to maxRetries times with exponential backoff.
 * @param {Function} fn - Function returning a promise
 * @param {object} options
 * @param {number} [options.maxRetries=2] - Maximum number of retries
 * @param {number} [options.baseDelayMs=100] - Base delay in ms
 * @param {Function} [options.shouldRetry] - Predicate to decide if error is retryable
 * @returns {Promise<any>}
 */
async function retryOperation(fn, options = {}) {
  const {
    maxRetries = 2,
    baseDelayMs = 150,
    shouldRetry = (err) => {
      // Retry on network errors or 5xx server errors, not on 4xx client errors
      if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
        return false;
      }
      return true;
    }
  } = options;

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (attempt === maxRetries || !shouldRetry(err)) {
        throw err;
      }
      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

module.exports = { retryOperation };
