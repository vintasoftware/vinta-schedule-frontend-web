/**
 * Workaround for a Storybook 10.5.0 bug that blanks every Docs page.
 *
 * `storybook/test` (a core annotation, always on) replaces
 * `HTMLElement.prototype.focus` with an accessor whose getter dereferences
 * `this.ownerDocument`. Libraries read the current focus off the *prototype*
 * (`const focus = HTMLElement.prototype.focus`) before wrapping it — and on the
 * prototype, `ownerDocument` throws `TypeError: Illegal invocation`.
 *
 * react-aria does exactly that, and Storybook's own Docs UI renders inside the
 * preview iframe, so once a story has run (installing the patch) every Docs page
 * throws during render and mounts nothing.
 *
 * The guard below delegates to Storybook's getter for real elements and returns
 * the native `focus` for any other receiver. Applied from a preview loader so it
 * runs *after* the core annotation has installed its accessor.
 *
 * Remove once Storybook ships a fix (tracked upstream; reproduce by opening any
 * story, then clicking its Docs tab).
 */
const nativeFocus = HTMLElement.prototype.focus;

const GUARDED = Symbol.for('vinta.storybook.guardedFocus');

export function patchFocus(): void {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'focus'
  );
  const get = descriptor?.get as (Getter & { [GUARDED]?: true }) | undefined;
  if (!get || get[GUARDED]) return;

  const guarded: Getter & { [GUARDED]?: true } = function (this: unknown) {
    return this instanceof HTMLElement ? get.call(this) : nativeFocus;
  };
  guarded[GUARDED] = true;

  Object.defineProperty(HTMLElement.prototype, 'focus', {
    configurable: true,
    get: guarded,
    set: descriptor?.set,
  });
}

type Getter = (this: unknown) => typeof nativeFocus;
