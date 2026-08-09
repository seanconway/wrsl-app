One corner's score. Square corners are load-bearing — a rounded score tile is wrong.

```jsx
<ScoreTile corner="green" points={7} advantages={1} penalties={0} size="mat" />
```

The corner colour is a top edge, never a fill behind the number. Advantages and penalties are counted below, never added to the point total.
