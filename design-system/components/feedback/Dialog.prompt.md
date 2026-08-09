Modal confirmation. The scrim is opaque ink at 72% with **no blur** — blur costs frames on matside hardware.

```jsx
<Dialog danger eyebrow="Mat 3 · R-1183" title="Disqualify red corner?"
  onClose={close}
  footer={<><Button variant="ghost" onClick={close}>Cancel</Button><Button variant="danger">Disqualify</Button></>}>
  The match ends immediately and the result is sent to the bracket.
</Dialog>
```

Positioned `absolute` so it can be demoed inside a device frame; give the parent `position: relative`.
