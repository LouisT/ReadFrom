/*!
 * Read text content from different endpoints. - https://ltdev.im/ - Copyright (c) 2016 Louis T.
 * Licensed under MIT license https://raw.githubusercontent.com/LouisT/ReadFrom/master/LICENSE
 */
"use strict";

class SSHPromise {
      constructor (DataFactory) {
          this.Client = new require('ssh2').Client();
          this.DataFactory = DataFactory;
      }

      // Return a Promise with an SSH client.
      execute (commands, sshoptions = {}, options = {}) {
          let opts = Object.assign({}, this.settings, options),
              buf = Buffer.alloc(0),
              ebuf = Buffer.alloc(0);

          return new Promise((resolve, reject) => {
              this.Client.on('ready', () => {
                  this.Client.exec(commands, (error, _Stream) => {
                      if (error) {
                         return reject(error);
                      }
                      _Stream.on('close', (code, signal) => {
                          this.Client.end();
                          try {
                             return resolve({
                                 stdout: this.DataFactory.compile(buf, opts),
                                 stderr: this.DataFactory.compile(ebuf, opts),
                                 code: code,
                                 signal: signal
                             });
                           } catch (error) {
                             return reject(error);
                          }
                       }).on('data', (chunk) => {
                           buf = this.DataFactory.concat(chunk, buf);
                       }).stderr.on('data', (echunk) => {
                           ebuf = this.DataFactory.concat(echunk, ebuf);
                      });
                  });
               }).on('error', (error) => {
                  reject(error);
              }).connect(sshoptions);
          });
      }

      // Convert `input` to a flat array.
      static ensureArray (input) {
          return [].concat.apply([], Array.of(input));
      }

      // Convert commands array/string to array, combine with options.concat
      static compile (cmds, options = {}) {
          return this.ensureArray(cmds[(options.combine && Array.isArray(cmds) ? 'join' : 'valueOf')](options.combine || ''));
      }
}

/*
 * Export the module for use!
 */
module.exports = SSHPromise;
