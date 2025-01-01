# Build

1. Stick to raw DOM, no framework
2. Index.html can embed pre-baked DOM, CSS and JS so it appears instant, would it work best?
3. The rest would be an app using:
3.1. Milkdown
3.2. Ag-Grid (probably)
3.3. XLS parser (maybe?)

One part of the build would need to process some "core" part of the code and inject it into HTML. 

Another part of the build would build the whole app into JS+CSS files.

# Sample MD

```http tty!
GET http://google.com
```

Preview this:
```json tty!
[{ red: 1, green: 2, blue: 3},
{apple: 10, pear: 20, google: 30}]
```

```jsx tty!
previewThis.map(x => <div>{JSON.stringify(x, null, 2)</div>)
```

# Parsing URLs

`/http://*** (+ headers)` -->  code block with `http go!` language prefixed with `GET `

`POST http://** (+headers, body)` --> code block with `http go!` language

`***` or `txt:***` --> Markdown but show unicode formatting controls

`fmt:***` --> Markdown with normal Markdown formatting

`js:**` --> code block with `js go!` language

### Might be optional:

`file:/path`  --> File manager

`file:?????` --> File manager use some funky compressed payload format