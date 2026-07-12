import * as React from 'react';

import { Flex, type FlexProps } from './flex';
import type { Space } from './layout-style';

/**
 * FormLayout — a real `<form>` element whose vertical rhythm is driven by a
 * prop, not by utility classes. It replaces the app's hand-rolled
 * `<form className='space-y-4'>` / `space-y-6` pattern:
 *
 *   <FormLayout gap={6} onSubmit={handleSubmit(onValid)}>…</FormLayout>
 *
 * It is a thin composition over the existing primitive — it renders
 * `<Flex as='form' direction='column' gap={gap}>` rather than reimplementing
 * any layout of its own.
 *
 * NOTE — `FormLayout` (the element + its layout) COMPOSES with `Form` from
 * `../ui/form` (react-hook-form's FormProvider). They are complementary, not
 * alternatives: `Form` supplies the rhf context, `FormLayout` renders the
 * actual `<form>` element and stacks the fields inside it. They also must not
 * share a name — the composer synthesizes a flat barrel across every subpath
 * export, so a second `Form` would be a hard name collision.
 *
 *   <Form {...form}>
 *     <FormLayout gap={4} onSubmit={form.handleSubmit(onValid)}>
 *       <FormField … />
 *     </FormLayout>
 *   </Form>
 */
export interface FormLayoutProps extends React.FormHTMLAttributes<HTMLFormElement> {
  /** Vertical space between children, on the DS 4px token scale. */
  gap?: Space;
  children?: React.ReactNode;
}

const FormLayout = React.forwardRef<HTMLFormElement, FormLayoutProps>(
  function FormLayout({ gap = 4, children, ...formProps }, ref) {
    return (
      <Flex
        as='form'
        direction='column'
        gap={gap}
        ref={ref as React.Ref<HTMLElement>}
        // Flex's rest props are typed for a generic element; the form-specific
        // attributes (action / method / noValidate / onSubmit …) are spread
        // straight onto the rendered <form>, so this cast is only about the
        // generic element type, never about what reaches the DOM.
        {...(formProps as Omit<FlexProps, 'as' | 'direction' | 'gap'>)}
      >
        {children}
      </Flex>
    );
  }
);

// esbuild can rename the inner forwardRef function when it collides with an
// inlined dependency export; pin the name the contract gate reads.
FormLayout.displayName = 'FormLayout';

export { FormLayout };
