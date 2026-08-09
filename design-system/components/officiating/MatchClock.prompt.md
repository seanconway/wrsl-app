The regulation clock. `M:SS`, tabular, no leading zero on minutes.

```jsx
<MatchClock seconds={272} running size="mat" label="Regulation" />
```

It ticks; it never animates, slides or counts. Under `warnUnder` seconds it turns `--signal-stop`.
