
// const NodeGeocoder = require('node-geocoder');

// const geocoder = NodeGeocoder({
//   provider: 'openstreetmap' // Free, no API key
// });

// module.exports = geocoder;
const NodeGeocoder = require('node-geocoder');

const geocoder = NodeGeocoder({
  provider: 'openstreetmap',
  headers: {
    'User-Agent': 'wanderlust-app/1.0 (berianiket9@gmail.com)'
  }
});

module.exports = geocoder;
