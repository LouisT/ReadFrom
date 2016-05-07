# ReadFrom
Read text content from different endpoints with Node.js.

#### Quick examples:
```javascript
ReadFrom().file('file.txt').then(function (data) {
   console.log(data);
 }).catch(function (error) {
   console.trace(error);
});

// echo "This is an example." | node stdin-example.js
ReadFrom().stdin().then(function (data) {
   console.log(data); // `This is an example.`
 }).catch(function (error) {
   console.trace(error);
});

ReadFrom().url('https://example.com/').then(function (data) {
   console.log(data); // Print the example.com HTML content.
 }).catch(function (error) {
   console.trace(error);
});

// Desktop only feature.
ReadFrom().clipboard().then(function (data) {
   console.log(data); // Print whatever is in your clipboard.
 }).catch(function (error) {
   console.trace(error);
});

// Read STDOUT from child_process.spawn()
// https://nodejs.org/dist/latest/docs/api/child_process.html#child_process_child_process_spawn_command_args_options
ReadFrom().spawn('top', ['-n 1', '-b']).then(function (data) {
   console.log(data); // Print a single iteration of the linux `top` command.
 }).catch(function (error) {
   console.trace(error);
});
```

TODO:
* Create documentation.
* Add tests with mocha.
