import Ember from 'ember';
import { BaseContext, getContext } from './setup-context';

let cachedOnerror: Map<BaseContext, ((error: Error) => void) | undefined> = new Map();

/**
 * Sets the `Ember.onerror` function for tests. This value is intended to be reset after
 * each test to ensure correct test isolation. To reset, you should simply call `setupOnerror`
 * without an `onError` argument.
 *
 * @public
 * @param {Function} onError the onError function to be set on Ember.onerror
 *
 * @example <caption>Example implementation for `ember-qunit` or `ember-mocha`</caption>
 *
 * import { setupOnerror } from '@ember/test-helpers';
 *
 * test('Ember.onerror is stubbed properly', function(assert) {
 *   setupOnerror(function(err) {
 *     assert.ok(err);
 *   });
 * });
 */
export default function setupOnerror(onError?: (error: Error) => void): void {
  let context = getContext();

  if (!context) {
    throw new Error('Must setup test context before calling setupOnerror');
  }

  if (!cachedOnerror.has(context)) {
    throw new Error(
      '_cacheOriginalOnerror must be called before setupOnerror. Normally, this will happen as part of your test harness.'
    );
  }

  if (typeof onError !== 'function') {
    onError = cachedOnerror.get(context);
  }

  // @ts-ignore types are incorrect and don't allow undefined.
  // See https://github.com/DefinitelyTyped/DefinitelyTyped/pull/51383
  Ember.onerror = onError;
}

/**
 * Resets `Ember.onerror` to the value it originally was at the start of the test run.
 *
 * @public
 *
 * @example
 *
 * import { resetOnerror } from '@ember/test-helpers';
 *
 * QUnit.testDone(function() {
 *   resetOnerror();
 * })
 */
export const resetOnerror: Function = setupOnerror;

/**
 * Caches the current value of Ember.onerror. When `setupOnerror` is called without a value
 * or when `resetOnerror` is called the value will be set to what was cached here.
 *
 * @private
 * @param {BaseContext} context the text context
 */
export function _prepareOnerror(context: BaseContext) {
  if (cachedOnerror.has(context)) {
    throw new Error('_prepareOnerror should only be called once per-context');
  }

  cachedOnerror.set(context, Ember.onerror);
}

/**
 * Removes the cached value of Ember.onerror.
 *
 * @private
 * @param {BaseContext} context the text context
 */
export function _cleanupOnerror(context: BaseContext) {
  resetOnerror();
  cachedOnerror.delete(context);
}
