/* globals EmberENV */
import { module, test } from 'qunit';
import Service from '@ember/service';
import Component from '@ember/component';
import TextField from '@ember/component/text-field';
import { helper } from '@ember/component/helper';
import {
  setupContext,
  setupRenderingContext,
  teardownContext,
  _registerHook,
  getTestMetadata,
  render,
  clearRender,
  setApplication,
  setResolver,
  triggerEvent,
  focus,
  blur,
  click,
  isSettled,
} from '@ember/test-helpers';
import hasEmberVersion from '@ember/test-helpers/has-ember-version';
import {
  setResolverRegistry,
  application,
  resolver,
} from '../helpers/resolver';
import { hbs } from 'ember-cli-htmlbars';
import { getOwner } from '@ember/application';

module('setupRenderingContext', function (hooks) {
  if (!hasEmberVersion(2, 4)) {
    return;
  }

  hooks.afterEach(function () {
    setApplication(application);
    setResolver(resolver);
  });

  function overwriteTest(key) {
    test(`throws an error when trying to overwrite this.${key}`, function (assert) {
      assert.throws(() => {
        this[key] = null;
      }, TypeError);
    });
  }

  function setupRenderingContextTests(hooks) {
    hooks.beforeEach(async function () {
      setResolverRegistry({
        'service:foo': Service.extend({ isFoo: true }),
        'template:components/template-only': hbs`template-only component here`,
        'component:js-only': Component.extend({
          classNames: ['js-only'],
        }),
        'helper:jax': helper(([name]) => `${name}-jax`),
        'template:components/outer-comp': hbs`outer{{inner-comp}}outer`,
        'template:components/inner-comp': hbs`inner`,
      });

      await setupContext(this);
      await setupRenderingContext(this);
    });

    hooks.afterEach(async function () {
      await teardownContext(this);
    });

    test('render works', async function (assert) {
      await render(hbs`Hi!`);

      assert.equal(this.element.textContent, 'Hi!');
    });

    if (EmberENV._APPLICATION_TEMPLATE_WRAPPER !== false) {
      test('render exposes an `.element` property with application template wrapper', async function (assert) {
        let rootElement = document.getElementById('ember-testing');
        assert.notEqual(
          this.element,
          rootElement,
          'this.element should not be rootElement'
        );
        assert.ok(
          rootElement.contains(this.element),
          'this.element is _within_ the rootElement'
        );
        await render(hbs`<p>Hello!</p>`);

        assert.equal(this.element.textContent, 'Hello!');
      });
    } else {
      test('render exposes an `.element` property without an application template wrapper', async function (assert) {
        let rootElement = document.getElementById('ember-testing');
        assert.equal(
          this.element,
          rootElement,
          'this.element should _be_ rootElement'
        );

        await render(hbs`<p>Hello!</p>`);

        assert.equal(this.element.textContent, 'Hello!');
      });
    }

    test('is settled after rendering', async function (assert) {
      await render(hbs`Hi!`);

      assert.ok(isSettled(), 'should be settled');
    });

    overwriteTest('element');

    test('it sets up test metadata', function (assert) {
      let testMetadata = getTestMetadata(this);

      assert.deepEqual(testMetadata.setupTypes, [
        'setupContext',
        'setupRenderingContext',
      ]);
    });

    test('it returns true for isRendering in an rendering test', function (assert) {
      let testMetadata = getTestMetadata(this);

      assert.ok(testMetadata.isRendering);
    });

    test('it executes registered render hooks for start and end at the right time', async function (assert) {
      assert.expect(3);

      let hookStart = _registerHook('render', 'start', () => {
        assert.step('render:start');
      });
      let hookEnd = _registerHook('render', 'end', () => {
        assert.step('render:end');
      });

      try {
        await render(hbs`<p>Hello!</p>`);

        assert.verifySteps(['render:start', 'render:end']);
      } finally {
        hookStart.unregister();
        hookEnd.unregister();
      }
    });

    test('render can be used multiple times', async function (assert) {
      await render(hbs`<p>Hello!</p>`);
      assert.equal(this.element.textContent, 'Hello!');

      await render(hbs`<p>World!</p>`);
      assert.equal(this.element.textContent, 'World!');
    });

    test('render does not run sync', async function (assert) {
      assert.ok(
        this.element,
        'precond - this.element is present (but empty) before render'
      );

      let renderPromise = render(hbs`<p>Hello!</p>`);

      assert.equal(
        this.element.textContent,
        '',
        'precond - this.element is not updated sync'
      );

      await renderPromise;

      assert.equal(this.element.textContent, 'Hello!');
    });

    test('clearRender can be used to clear the previously rendered template', async function (assert) {
      let testingRootElement = document.getElementById('ember-testing');
      let originalElement = this.element;

      await render(hbs`<p>Hello!</p>`);

      assert.equal(this.element.textContent, 'Hello!', 'has rendered content');
      assert.equal(
        testingRootElement.textContent,
        'Hello!',
        'has rendered content'
      );

      await clearRender();

      assert.equal(this.element.textContent, '', 'has rendered content');
      assert.equal(testingRootElement.textContent, '', 'has rendered content');
      assert.strictEqual(
        this.element,
        originalElement,
        'this.element is stable'
      );
    });

    test('is settled after clearRender', async function (assert) {
      await render(hbs`<p>Hello!</p>`);

      await clearRender();

      assert.ok(isSettled(), 'should be settled');
    });

    overwriteTest('render');
    overwriteTest('clearRender');

    test('can invoke template only components', async function (assert) {
      await render(hbs`{{template-only}}`);

      assert.equal(this.element.textContent, 'template-only component here');
    });

    test('can invoke JS only components', async function (assert) {
      await render(hbs`{{js-only}}`);

      assert.ok(
        this.element.querySelector('.js-only'),
        'element found for js-only component'
      );
    });

    test('can invoke helper', async function (assert) {
      await render(hbs`{{jax "max"}}`);

      assert.equal(this.element.textContent, 'max-jax');
    });

    test('can pass arguments to helper from context', async function (assert) {
      this.set('name', 'james');

      await render(hbs`{{jax name}}`);

      assert.equal(this.element.textContent, 'james-jax');
    });

    test('can render a component that renders other components', async function (assert) {
      await render(hbs`{{outer-comp}}`);

      assert.equal(this.element.textContent, 'outerinnerouter');
    });

    test('can use the component helper in its layout', async function (assert) {
      this.owner.register('template:components/x-foo', hbs`x-foo here`);

      await render(hbs`{{component 'x-foo'}}`);

      assert.equal(this.element.textContent, 'x-foo here');
    });

    test('can create a component instance for direct testing without a template', function (assert) {
      this.owner.register(
        'component:foo-bar',
        Component.extend({
          someMethod() {
            return 'hello thar!';
          },
        })
      );

      let subject;
      if (hasEmberVersion(2, 12)) {
        subject = this.owner.lookup('component:foo-bar');
      } else {
        subject = this.owner._lookupFactory('component:foo-bar').create();
      }

      assert.equal(subject.someMethod(), 'hello thar!');
    });

    test('can handle a click event', async function (assert) {
      assert.expect(2);

      this.owner.register(
        'component:x-foo',
        Component.extend({
          click() {
            assert.ok(true, 'click was fired');
          },
        })
      );
      this.owner.register(
        'template:components/x-foo',
        hbs`<button>Click me!</button>`
      );

      await render(hbs`{{x-foo}}`);

      assert.equal(
        this.element.textContent,
        'Click me!',
        'precond - component was rendered'
      );
      await click(this.element.querySelector('button'));
    });

    test('can use action based event handling', async function (assert) {
      assert.expect(2);

      this.owner.register(
        'component:x-foo',
        Component.extend({
          actions: {
            clicked() {
              assert.ok(true, 'click was fired');
            },
          },
        })
      );
      this.owner.register(
        'template:components/x-foo',
        hbs`<button {{action 'clicked'}}>Click me!</button>`
      );

      await render(hbs`{{x-foo}}`);

      assert.equal(
        this.element.textContent,
        'Click me!',
        'precond - component was rendered'
      );
      await click(this.element.querySelector('button'));
    });

    test('can pass function to be used as a "closure action"', async function (assert) {
      assert.expect(2);

      this.owner.register('component:x-foo', Component.extend());
      this.owner.register(
        'template:components/x-foo',
        hbs`<button onclick={{action clicked}}>Click me!</button>`
      );

      this.set('clicked', () => assert.ok(true, 'action was triggered'));
      await render(hbs`{{x-foo clicked=clicked}}`);

      assert.equal(
        this.element.textContent,
        'Click me!',
        'precond - component was rendered'
      );
      await click(this.element.querySelector('button'));
    });

    test('can pass function to be used as a "closure action" to a template only component', async function (assert) {
      assert.expect(2);

      let template = hbs`<button onclick={{action @clicked}}>Click me!</button>`;

      this.owner.register('template:components/x-foo', template);

      this.set('clicked', () => assert.ok(true, 'action was triggered'));
      await render(hbs`{{x-foo clicked=clicked}}`);

      assert.equal(
        this.element.textContent,
        'Click me!',
        'precond - component was rendered'
      );
      await click(this.element.querySelector('button'));
    });

    test('can update a passed in argument with an <input>', async function (assert) {
      this.owner.register('component:my-input', TextField.extend({}));

      await render(hbs`{{my-input value=value}}`);

      let input = this.element.querySelector('input');

      assert.strictEqual(
        this.get('value'),
        undefined,
        'precond - property is initially null'
      );
      assert.equal(
        input.value,
        '',
        'precond - element value is initially empty'
      );

      // trigger the change
      input.value = '1';
      await triggerEvent(input, 'change');

      assert.equal(this.get('value'), '1');
    });

    test('it supports dom triggered focus events', async function (assert) {
      this.owner.register(
        'component:my-input',
        TextField.extend({
          init() {
            this._super(...arguments);

            this.set('value', 'init');
          },
          focusIn() {
            this.set('value', 'focusin');
          },
          focusOut() {
            this.set('value', 'focusout');
          },
        })
      );
      await this.render(hbs`{{my-input}}`);

      let input = this.element.querySelector('input');
      assert.equal(input.value, 'init');

      await focus(input);
      assert.equal(input.value, 'focusin');

      await blur(input);
      assert.equal(input.value, 'focusout');
    });

    test('two way bound arguments are updated', async function (assert) {
      this.owner.register(
        'component:my-component',
        Component.extend({
          actions: {
            clicked() {
              this.set('foo', 'updated!');
            },
          },
        })
      );
      this.owner.register(
        'template:components/my-component',
        hbs`<button {{action 'clicked'}}>{{foo}}</button>`
      );

      this.set('foo', 'original');
      await render(hbs`{{my-component foo=foo}}`);
      assert.equal(
        this.element.textContent,
        'original',
        'value after initial render'
      );

      await click(this.element.querySelector('button'));
      assert.equal(
        this.element.textContent,
        'updated!',
        'value after updating'
      );
      assert.equal(this.get('foo'), 'updated!');
    });

    test('two way bound arguments are available after clearRender is called', async function (assert) {
      this.owner.register(
        'component:my-component',
        Component.extend({
          actions: {
            clicked() {
              this.set('foo', 'updated!');
              this.set('bar', 'updated bar!');
            },
          },
        })
      );
      this.owner.register(
        'template:components/my-component',
        hbs`<button {{action 'clicked'}}>{{foo}}</button>`
      );

      // using two arguments here to ensure the two way binding
      // works both for things rendered in the component's layout
      // and those only used in the components JS file
      await render(hbs`{{my-component foo=foo bar=bar}}`);
      await click(this.element.querySelector('button'));

      await clearRender();

      assert.equal(this.get('foo'), 'updated!');
      assert.equal(this.get('bar'), 'updated bar!');
    });

    test('imported `render` can be used instead of render', async function (assert) {
      await render(hbs`yippie!!`);

      assert.equal(this.element.textContent, 'yippie!!');
    });

    test('imported clearRender can be used instead of this.clearRender', async function (assert) {
      let testingRootElement = document.getElementById('ember-testing');
      let originalElement = this.element;

      await render(hbs`<p>Hello!</p>`);

      assert.equal(this.element.textContent, 'Hello!', 'has rendered content');
      assert.equal(
        testingRootElement.textContent,
        'Hello!',
        'has rendered content'
      );

      await clearRender();

      assert.equal(this.element.textContent, '', 'has rendered content');
      assert.equal(testingRootElement.textContent, '', 'has rendered content');
      assert.strictEqual(
        this.element,
        originalElement,
        'this.element is stable'
      );
    });

    test('context supports getOwner', async function (assert) {
      assert.equal(getOwner(this), this.owner);
    });

    module('this.render and this.clearRender deprecations', function () {
      test('this.render() and this.clearRender deprecation message', async function (assert) {
        await this.render(hbs`<button>Click me</button>`);

        assert.expect(3);

        assert.equal(
          this.element.querySelector('button').textContent.trim(),
          'Click me',
          'Button is still rendered'
        );

        assert.deprecationsInclude(
          'Using this.render has been deprecated, consider using `render` imported from `@ember/test-helpers`.'
        );

        await this.clearRender();

        assert.deprecationsInclude(
          'Using this.clearRender has been deprecated, consider using `clearRender` imported from `@ember/test-helpers`.'
        );
      });
    });
  }

  module('with only application set', function (hooks) {
    hooks.beforeEach(function () {
      setResolver(null);
      setApplication(application);
    });

    setupRenderingContextTests(hooks);
  });

  module('with application and resolver set', function (hooks) {
    hooks.beforeEach(function () {
      setResolver(resolver);
      setApplication(application);
    });

    setupRenderingContextTests(hooks);
  });

  module('with only resolver set', function (hooks) {
    hooks.beforeEach(function () {
      setResolver(resolver);
      setApplication(null);
    });

    setupRenderingContextTests(hooks);
  });
});
