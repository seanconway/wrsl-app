The standard action button — label is always a verb phrase in sentence case ("Start match", never "Submit").

```jsx
<Button variant="primary" size="glove" iconLeft="play">Start match</Button>
<Button variant="secondary" iconLeft="printer">Print bracket</Button>
<Button variant="danger" size="sm">Disqualify</Button>
```

Variants: `primary` (lime, one per view) · `secondary` (bordered) · `ghost` · `danger`. Sizes `sm | md | lg | glove`; use `glove` (64px) for anything a referee presses mid-match — it deliberately does not shrink on press.
