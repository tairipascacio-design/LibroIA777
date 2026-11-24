/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-afac4cd2'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "pwa-maskable-512x512.png",
    "revision": "346d4098419da4b1bff68704d32d4cc6"
  }, {
    "url": "pwa-512x512.png",
    "revision": "1ebb13d4e7839d725f1b43f4894c255c"
  }, {
    "url": "pwa-192x192.png",
    "revision": "4c2c776a84151183d9e723ae56b1e7cd"
  }, {
    "url": "index.html",
    "revision": "03f037ff706612a757916f6508a8f548"
  }, {
    "url": "icon.svg",
    "revision": "e09b253961f8d1aa907e573468d44db4"
  }, {
    "url": "icon-maskable.svg",
    "revision": "495fa914b05768fd17a46de1be97b1af"
  }, {
    "url": "favicon.ico",
    "revision": "59b959d8116cd944d84af1636c6d3dd5"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "ec50316cd21013073ecc0bb239defedc"
  }, {
    "url": "assets/index-D-KDFerH.js",
    "revision": null
  }, {
    "url": "assets/index-CSCfEGwt.css",
    "revision": null
  }, {
    "url": "assets/apkPayload-BcLNMNUz.js",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "ec50316cd21013073ecc0bb239defedc"
  }, {
    "url": "favicon.ico",
    "revision": "59b959d8116cd944d84af1636c6d3dd5"
  }, {
    "url": "icon-maskable.svg",
    "revision": "495fa914b05768fd17a46de1be97b1af"
  }, {
    "url": "icon.svg",
    "revision": "e09b253961f8d1aa907e573468d44db4"
  }, {
    "url": "pwa-192x192.png",
    "revision": "4c2c776a84151183d9e723ae56b1e7cd"
  }, {
    "url": "pwa-512x512.png",
    "revision": "1ebb13d4e7839d725f1b43f4894c255c"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "346d4098419da4b1bff68704d32d4cc6"
  }, {
    "url": "manifest.webmanifest",
    "revision": "dfd1e5327eb58763702ec81b9546c242"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html"), {
    denylist: [/^\/api\//]
  }));
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
