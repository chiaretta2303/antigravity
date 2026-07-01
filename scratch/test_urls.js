const https = require('https');

const urls = [
  "https://unpkg.com/three@0.185.0/build/three.module.js",
  "https://unpkg.com/three@0.185.0/examples/jsm/loaders/GLTFLoader.js",
  "https://unpkg.com/three@0.185.0/examples/jsm/loaders/EXRLoader.js",
  "https://unpkg.com/three@0.185.0/examples/jsm/controls/OrbitControls.js",
  "https://unpkg.com/three@0.185.0/examples/jsm/renderers/CSS2DRenderer.js",
  "https://unpkg.com/gsap@3.15.0/index.js"
];

function checkUrl(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      console.log(`${url} -> ${res.statusCode}`);
      resolve();
    }).on('error', (e) => {
      console.log(`${url} -> Error: ${e.message}`);
      resolve();
    });
  });
}

(async () => {
  for (const url of urls) {
    await checkUrl(url);
  }
})();
